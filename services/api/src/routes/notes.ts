import { logError } from '../utils/logger.js';
import { Router, Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validate.js';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import {
  notes,
  noteVersions,
  addMores,
  people,
  notePeople,
  receipts,
  boxes,
  personMentions,
  mentionCandidates,
  clarificationQuestions,
  clarificationOptions
} from '../db/schema.js';
import { eq, and, isNull, desc, inArray, sql } from 'drizzle-orm';
import { encrypt, decrypt } from '../utils/crypto.js';
import { auditRoute } from '../middleware/audit.js';
import { trackEvent } from '../utils/telemetry.js';
import { eligibilityMiddleware } from '../middleware/eligibility.js';
import { runMentionPipeline } from '../utils/mention-pipeline.js';
import { getEffectiveEntitlement } from '../services/entitlementResolver.js';
import { durableIdempotencyMiddleware } from '../middleware/idempotency.js';

const router = Router();

const idParamSchema = z.object({
  id: z.string().uuid()
});

const personSpanSchema = z.object({
  clientSpanId: z.string(),
  personId: z.string().uuid(),
  displayText: z.string(),
  startOffset: z.number().int().nonnegative(),
  endOffset: z.number().int().nonnegative()
});

const createNoteSchema = z.object({
  boxId: z.string().uuid(),
  body: z.string().optional(),
  text: z.string().optional(),
  peopleNames: z.array(z.string().min(1)).optional(),
  personSpans: z.array(personSpanSchema).optional(),
  clientMutationId: z.string().optional()
}).refine(data => data.body || data.text, {
  message: "Either body or text is required",
  path: ["body"]
});

const updateNoteSchema = z.object({
  body: z.string().optional(),
  text: z.string().optional(),
  personSpans: z.array(personSpanSchema).optional(),
  clientMutationId: z.string().optional()
}).refine(data => data.body || data.text, {
  message: "Either body or text is required",
  path: ["body"]
});

const addMoreSchema = z.object({
  body: z.string().min(1),
  clientMutationId: z.string().min(1).max(200).optional(),
});

// Apply auth middleware to all routes in this group
router.use(authMiddleware);
router.use(eligibilityMiddleware);
router.use(durableIdempotencyMiddleware);

/**
 * GET /v1/notes
 * Fetch notes. Supports optional boxId filtering and search query.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const { boxId, q } = req.query;

  try {
    const userId = req.user!.userId;

    let conditions = and(eq(notes.userId, userId), isNull(notes.deletedAt));
    if (boxId) {
      conditions = and(conditions, eq(notes.boxId, boxId as string));
    }

    const allNotes = await db
      .select()
      .from(notes)
      .where(conditions)
      .orderBy(desc(notes.createdAt));

    const receiptCountRows = allNotes.length === 0
      ? []
      : await db
        .select({
          noteId: receipts.noteId,
          count: sql<number>`count(*)::int`,
        })
        .from(receipts)
        .where(and(eq(receipts.userId, userId), inArray(receipts.noteId, allNotes.map((note) => note.id))))
        .groupBy(receipts.noteId);
    const receiptCounts = new Map(receiptCountRows.map((row) => [row.noteId, Number(row.count)]));

    // Decrypt note bodies
    const decryptedNotes = allNotes.map((note) => ({
      ...note,
      body: decrypt(note.body),
      receiptsCount: receiptCounts.get(note.id) || 0,
    }));

    // If search query is provided, filter in memory
    if (q) {
      const query = (q as string).toLowerCase().trim();
      const filtered = decryptedNotes.filter((note) =>
        note.body.toLowerCase().includes(query)
      );
      res.json(filtered);
      return;
    }

    res.json(decryptedNotes);
  } catch (error) {
    logError('Error fetching notes:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve notes' });
  }
});

/**
 * POST /v1/notes
 * Create a new note. Auto-creates versions, links people, and encrypts body.
 */
router.post('/', auditRoute('create_note', 'note'), validateRequest({ body: createNoteSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const { boxId, body, text, peopleNames, personSpans = [], clientMutationId } = req.body;
  const userId = req.user!.userId;

  const rawContent = body || text;

  try {
    let noteLimitExceeded = false;
    let targetBoxFound = true;

    // Validate personSpans overlaps and offsets
    for (const span of personSpans) {
      const substring = rawContent.substring(span.startOffset, span.endOffset);
      if (substring !== span.displayText) {
        res.status(400).json({ error: 'ValidationError', message: `Span offset does not match display text: '${substring}' vs '${span.displayText}'` });
        return;
      }

      const [person] = await db
        .select()
        .from(people)
        .where(and(eq(people.id, span.personId), eq(people.userId, userId), eq(people.status, 'active')))
        .limit(1);

      if (!person) {
        res.status(403).json({ error: 'ForbiddenError', message: 'Target person not found or access denied' });
        return;
      }
    }

    for (let i = 0; i < personSpans.length; i++) {
      for (let j = i + 1; j < personSpans.length; j++) {
        const s1 = personSpans[i];
        const s2 = personSpans[j];
        if ((s1.startOffset >= s2.startOffset && s1.startOffset < s2.endOffset) ||
            (s1.endOffset > s2.startOffset && s1.endOffset <= s2.endOffset)) {
          res.status(400).json({ error: 'ValidationError', message: 'Overlapping spans are not allowed' });
          return;
        }
      }
    }

    const encryptedBody = encrypt(rawContent);

    // Perform box lock, entitlement note limit check, and note creation atomically
    let newNote: any;
    let initialVersion: any;

    await db.transaction(async (tx) => {
      // 1. Lock target Box row
      const [box] = await tx
        .select()
        .from(boxes)
        .where(and(eq(boxes.id, boxId), eq(boxes.userId, userId), isNull(boxes.deletedAt)))
        .for('update');

      if (!box) {
        targetBoxFound = false;
        return;
      }

      // 2. Canonical entitlement Note creation limit check (maximum 5 Notes per Box for Free tier)
      const entitlement = await getEffectiveEntitlement(userId, new Date(), tx);
      if (!entitlement.capabilities.unlimitedNotes) {
        const existingNotesInBox = await tx
          .select()
          .from(notes)
          .where(and(eq(notes.boxId, boxId), eq(notes.userId, userId), isNull(notes.deletedAt)));

        if (existingNotesInBox.length >= 5) {
          noteLimitExceeded = true;
          return;
        }
      }

      const [createdNote] = await tx
        .insert(notes)
        .values({ userId, boxId, body: encryptedBody })
        .returning();
      newNote = createdNote;

      [initialVersion] = await tx.insert(noteVersions).values({
        noteId: createdNote.id,
        body: encryptedBody,
        versionNum: 1,
      }).returning();
    });

    if (!targetBoxFound) {
      res.status(404).json({ error: 'NotFoundError', message: 'Target box not found or access denied' });
      return;
    }

    if (noteLimitExceeded) {
      res.status(402).json({
        error: 'NOTE_LIMIT_REACHED',
        message: 'Free account limit reached (maximum 5 Notes per Box allowed). Upgrade to Pro for unlimited Notes.',
      });
      return;
    }

    // Store explicit spans as confirmed PersonMention records
    for (const span of personSpans) {
      await db.insert(personMentions).values({
        userId,
        sourceType: 'note',
        sourceId: newNote.id,
        sourceVersionId: initialVersion.id,
        rawText: span.displayText,
        normalizedText: span.displayText.toLowerCase().trim(),
        startOffset: span.startOffset,
        endOffset: span.endOffset,
        origin: 'explicit_at_tag',
        status: 'confirmed',
        linkedPersonId: span.personId,
        candidateConfidence: 1.0,
        confidenceBand: 'high',
        resolutionSource: 'explicit_tag',
        resolutionVersion: 1
      });

      // Also link to notePeople for backward compatibility
      await db.insert(notePeople).values({
        noteId: newNote.id,
        personId: span.personId,
      }).onConflictDoNothing();
    }

    // Handle tag associations (peopleNames) for compatibility
    if (Array.isArray(peopleNames) && peopleNames.length > 0) {
      for (const name of peopleNames) {
        const cleanName = name.trim();
        if (!cleanName) continue;

        // Find or create person
        let [person] = await db
          .select()
          .from(people)
          .where(and(eq(people.userId, userId), eq(people.displayName, cleanName)))
          .limit(1);

        if (!person) {
          const [newPerson] = await db
            .insert(people)
            .values({
              userId,
              displayName: cleanName,
            })
            .returning();
          person = newPerson;
        }

        // Link person to note
        await db.insert(notePeople).values({
          noteId: newNote.id,
          personId: person.id,
        }).onConflictDoNothing();
      }
    }

    await trackEvent(userId, 'note_created', { noteId: newNote.id, boxId });
    if (personSpans.length > 0) {
      await trackEvent(userId, 'inline_person_tagged', { noteId: newNote.id });
    }

    // Run mention pipeline asynchronously to generate candidates/clarifications
    const pipelineResult = await runMentionPipeline(
      newNote.id,
      initialVersion.id,
      rawContent,
      personSpans,
      userId,
      clientMutationId
    );

    const responsePayload = {
      ...newNote,
      body: rawContent, // return plain text to client
      receiptsCount: 0,
      clarifications: pipelineResult.questions
    };

    res.status(201).json(responsePayload);
  } catch (error) {
    logError('Error creating note:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to create note' });
  }
});

/**
 * GET /v1/notes/:id
 * Get details of a single note (including versions, people, and decrypted body)
 */
router.get('/:id', validateRequest({ params: idParamSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user!.userId;

  try {
    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId), isNull(notes.deletedAt)))
      .limit(1);

    if (!note) {
      res.status(404).json({ error: 'NotFoundError', message: 'Note not found' });
      return;
    }

    // Fetch versions
    const versions = await db
      .select()
      .from(noteVersions)
      .where(eq(noteVersions.noteId, note.id))
      .orderBy(desc(noteVersions.versionNum));

    // Fetch add-mores
    const addMoreBlocks = await db
      .select()
      .from(addMores)
      .where(eq(addMores.noteId, note.id))
      .orderBy(desc(addMores.createdAt));

    // Fetch associated people
    const linkedPeople = await db
      .select({
        id: people.id,
        name: people.displayName,
      })
      .from(notePeople)
      .innerJoin(people, eq(notePeople.personId, people.id))
      .where(eq(notePeople.noteId, note.id));

    const [receiptCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(receipts)
      .where(and(eq(receipts.noteId, note.id), eq(receipts.userId, userId)));

    res.json({
      ...note,
      body: decrypt(note.body),
      receiptsCount: Number(receiptCount?.count || 0),
      versions: versions.map((v) => ({
        ...v,
        body: decrypt(v.body),
      })),
      addMores: addMoreBlocks.map((a) => ({
        ...a,
        body: decrypt(a.body),
      })),
      people: linkedPeople,
    });
  } catch (error) {
    logError('Error fetching note details:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to fetch note details' });
  }
});

/**
 * PATCH /v1/notes/:id
 * Update note body. Creates a new version.
 */
router.patch('/:id', auditRoute('update_note', 'note'), validateRequest({ params: idParamSchema, body: updateNoteSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const { body, text, personSpans = [], clientMutationId } = req.body;
  const userId = req.user!.userId;

  const rawContent = body || text;

  try {
    // Canonical entitlement editing check
    const entitlement = await getEffectiveEntitlement(userId);
    if (!entitlement.capabilities.editing) {
      res.status(402).json({
        error: 'EDITING_RESTRICTED',
        message: 'Editing existing Notes requires an active Pro subscription or promotional access.',
      });
      return;
    }

    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId), isNull(notes.deletedAt)))
      .limit(1);

    if (!note) {
      res.status(404).json({ error: 'NotFoundError', message: 'Note not found' });
      return;
    }

    // Validate personSpans
    for (const span of personSpans) {
      const substring = rawContent.substring(span.startOffset, span.endOffset);
      if (substring !== span.displayText) {
        res.status(400).json({ error: 'ValidationError', message: `Span offset does not match display text: '${substring}' vs '${span.displayText}'` });
        return;
      }

      const [person] = await db
        .select()
        .from(people)
        .where(and(eq(people.id, span.personId), eq(people.userId, userId), eq(people.status, 'active')))
        .limit(1);

      if (!person) {
        res.status(403).json({ error: 'ForbiddenError', message: 'Target person not found or access denied' });
        return;
      }
    }

    // Reject overlaps
    for (let i = 0; i < personSpans.length; i++) {
      for (let j = i + 1; j < personSpans.length; j++) {
        const s1 = personSpans[i];
        const s2 = personSpans[j];
        if ((s1.startOffset >= s2.startOffset && s1.startOffset < s2.endOffset) ||
            (s1.endOffset > s2.startOffset && s1.endOffset <= s2.endOffset)) {
          res.status(400).json({ error: 'ValidationError', message: 'Overlapping spans are not allowed' });
          return;
        }
      }
    }

    const encryptedBody = encrypt(rawContent);

    // Get current version number
    const [latestVersion] = await db
      .select()
      .from(noteVersions)
      .where(eq(noteVersions.noteId, note.id))
      .orderBy(desc(noteVersions.versionNum))
      .limit(1);

    const nextVersionNum = latestVersion ? latestVersion.versionNum + 1 : 1;

    // Create new version entry
    const [newVersion] = await db.insert(noteVersions).values({
      noteId: note.id,
      body: encryptedBody,
      versionNum: nextVersionNum,
    }).returning();

    // Store explicit spans as confirmed PersonMention records for the new version
    for (const span of personSpans) {
      await db.insert(personMentions).values({
        userId,
        sourceType: 'note',
        sourceId: note.id,
        sourceVersionId: newVersion.id,
        rawText: span.displayText,
        normalizedText: span.displayText.toLowerCase().trim(),
        startOffset: span.startOffset,
        endOffset: span.endOffset,
        origin: 'explicit_at_tag',
        status: 'confirmed',
        linkedPersonId: span.personId,
        candidateConfidence: 1.0,
        confidenceBand: 'high',
        resolutionSource: 'explicit_tag',
        resolutionVersion: 1
      });

      await db.insert(notePeople).values({
        noteId: note.id,
        personId: span.personId,
      }).onConflictDoNothing();
    }

    // Update note record
    const [updatedNote] = await db
      .update(notes)
      .set({
        body: encryptedBody,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id))
      .returning();

    await trackEvent(userId, 'note_edited', { noteId: id });

    // Run mention pipeline asynchronously to generate candidates/clarifications
    const pipelineResult = await runMentionPipeline(
      note.id,
      newVersion.id,
      rawContent,
      personSpans,
      userId,
      clientMutationId
    );

    const responsePayload = {
      ...updatedNote,
      body: rawContent,
      clarifications: pipelineResult.questions
    };

    res.json(responsePayload);
  } catch (error) {
    logError('Error updating note:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to update note' });
  }
});

/**
 * DELETE /v1/notes/:id
 * Soft-deletes the note.
 */
router.delete('/:id', auditRoute('delete_note', 'note'), validateRequest({ params: idParamSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const userId = req.user!.userId;

  try {
    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId), isNull(notes.deletedAt)))
      .limit(1);

    if (!note) {
      res.status(404).json({ error: 'NotFoundError', message: 'Note not found' });
      return;
    }

    await db
      .update(notes)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id));

    await trackEvent(userId, 'note_deleted_soft', { noteId: id });

    res.json({ success: true, message: 'Note soft-deleted successfully' });
  } catch (error) {
    logError('Error deleting note:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to delete note' });
  }
});

/**
 * GET /v1/notes/:id/add-more
 * List canonical Add-more blocks for an owned, active Note.
 */
router.get('/:id/add-more', validateRequest({ params: idParamSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const noteId = req.params.id as string;
  const userId = req.user!.userId;

  try {
    const [note] = await db
      .select({ id: notes.id })
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, userId), isNull(notes.deletedAt)))
      .limit(1);

    if (!note) {
      res.status(404).json({ error: 'NotFoundError', message: 'Note not found' });
      return;
    }

    const blocks = await db
      .select()
      .from(addMores)
      .where(eq(addMores.noteId, noteId))
      .orderBy(desc(addMores.createdAt));

    res.json(blocks.map((block) => ({ ...block, body: decrypt(block.body) })));
  } catch (error) {
    logError('Error listing Add-more content:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve Add-more content' });
  }
});

/**
 * POST /v1/notes/:id/add-more
 * Append an add-more block of text to a note.
 */
router.post('/:id/add-more', auditRoute('create_add_more', 'note'), validateRequest({ params: idParamSchema, body: addMoreSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;
  const { body } = req.body;
  const userId = req.user!.userId;

  if (!body) {
    res.status(400).json({ error: 'ValidationError', message: 'Block content is required' });
    return;
  }

  try {
    const [note] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), eq(notes.userId, userId), isNull(notes.deletedAt)))
      .limit(1);

    if (!note) {
      res.status(404).json({ error: 'NotFoundError', message: 'Note not found' });
      return;
    }

    const encryptedBlock = encrypt(body);

    const [newBlock] = await db
      .insert(addMores)
      .values({
        noteId: note.id,
        body: encryptedBlock,
      })
      .returning();

    // Also update parent note timestamp
    await db
      .update(notes)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(notes.id, note.id));

    await trackEvent(userId, 'add_more_added', { noteId: note.id, blockId: newBlock.id });

    res.status(201).json({
      ...newBlock,
      body,
    });
  } catch (error) {
    logError('Error adding more content to note:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to append note content' });
  }
});

/**
 * GET /v1/notes/:id/mentions
 * Retrieve all mentions with their candidates for a note
 */
router.get('/:id/mentions', validateRequest({ params: idParamSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const noteId = req.params.id as string;
  const userId = req.user!.userId;

  try {
    const mentionsList = await db
      .select()
      .from(personMentions)
      .where(and(eq(personMentions.userId, userId), eq(personMentions.sourceId, noteId)));

    const result = [];
    for (const mention of mentionsList) {
      const candidates = await db
        .select({
          personId: people.id,
          displayName: people.displayName,
          score: mentionCandidates.score,
          rank: mentionCandidates.rank
        })
        .from(mentionCandidates)
        .innerJoin(people, eq(mentionCandidates.personId, people.id))
        .where(eq(mentionCandidates.mentionId, mention.id))
        .orderBy(mentionCandidates.rank);

      result.push({
        ...mention,
        candidates
      });
    }

    res.json(result);
  } catch (error) {
    logError('Error fetching note mentions:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve note mentions' });
  }
});

/**
 * GET /v1/notes/:id/clarifications
 * Retrieve pending clarification questions for a note
 */
router.get('/:id/clarifications', validateRequest({ params: idParamSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const noteId = req.params.id as string;
  const userId = req.user!.userId;

  try {
    const questionsList = await db
      .select()
      .from(clarificationQuestions)
      .where(and(
        eq(clarificationQuestions.userId, userId),
        eq(clarificationQuestions.noteId, noteId),
        eq(clarificationQuestions.status, 'pending')
      ));

    const result = [];
    for (const question of questionsList) {
      const options = await db
        .select()
        .from(clarificationOptions)
        .where(eq(clarificationOptions.questionId, question.id))
        .orderBy(clarificationOptions.sortOrder);

      result.push({
        ...question,
        options
      });
    }

    res.json(result);
  } catch (error) {
    logError('Error fetching note clarifications:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve note clarifications' });
  }
});

export default router;

import { logError } from '../utils/logger.js';
import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import {
  people,
  personAliases,
  personRoles,
  personMentions,
  mentionCandidates,
  mentionResolutionEvents,
  clarificationQuestions,
  clarificationOptions,
  personMerges,
  boxes,
  notePeople,
  boxPeople,
  notes
} from '../db/schema.js';
import { eq, and, isNull, or, inArray, desc } from 'drizzle-orm';
import { auditRoute } from '../middleware/audit.js';
import { trackEvent } from '../utils/telemetry.js';
import { normalizeText, isPhoneticallySimilar } from '../utils/mention-pipeline.js';
import { z } from 'zod';
import { validateRequest } from '../middleware/validate.js';
import { eligibilityMiddleware } from '../middleware/eligibility.js';
import { durableIdempotencyMiddleware } from '../middleware/idempotency.js';

const router = Router();

// This router is mounted at `/v1` because it owns People, mention-review, and
// clarification endpoints. Scope its guards so they cannot intercept unrelated
// `/v1` routes that are registered after it (for example public webhooks).
const guardedPrefixes = ['/people', '/mentions', '/clarifications'];
router.use(guardedPrefixes, authMiddleware);
router.use(guardedPrefixes, eligibilityMiddleware);
router.use(guardedPrefixes, durableIdempotencyMiddleware);

// Validators
const idParamSchema = z.object({
  id: z.string().uuid()
});

const createPersonSchema = z.object({
  displayName: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  fullName: z.string().optional().nullable(),
  contextLabel: z.string().optional().nullable(),
  avatarReceiptId: z.string().uuid().optional().nullable(),
  status: z.enum(['active', 'archived', 'deleted']).optional(),
  clientMutationId: z.string().optional()
}).refine(data => data.displayName || data.name, {
  message: "Either displayName or name is required",
  path: ["displayName"]
});

const updatePersonSchema = z.object({
  displayName: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  fullName: z.string().optional().nullable(),
  contextLabel: z.string().optional().nullable(),
  avatarReceiptId: z.string().uuid().optional().nullable(),
  status: z.enum(['active', 'archived', 'deleted']).optional()
});

const createAliasSchema = z.object({
  rawValue: z.string().min(1),
  aliasType: z.enum(['name', 'nickname', 'relationship', 'abbreviation', 'dictation_variant', 'misspelling', 'role_phrase', 'custom']),
  matchMode: z.enum(['exact', 'phrase', 'phonetic', 'fuzzy']),
  scopeType: z.enum(['mention', 'box', 'category', 'time_range', 'global']),
  scopeId: z.string().uuid().optional().nullable(),
  validFrom: z.string().optional().nullable(),
  validTo: z.string().optional().nullable(),
  confirmationStatus: z.enum(['user_confirmed', 'system_suggested', 'rejected']),
  autoConfirmAllowed: z.boolean().optional()
});

const resolveMentionSchema = z.object({
  personId: z.string().uuid(),
  expectedResolutionVersion: z.number().int(),
  clientMutationId: z.string(),
  autoConfirmRule: z.boolean().optional()
});

const reassignMentionSchema = z.object({
  personId: z.string().uuid(),
  expectedResolutionVersion: z.number().int(),
  clientMutationId: z.string()
});

const answerClarificationSchema = z.object({
  optionId: z.string().uuid(),
  expectedQuestionVersion: z.number().int(),
  clientMutationId: z.string()
});

const mergePeopleSchema = z.object({
  survivingPersonId: z.string().uuid(),
  mergedPersonId: z.string().uuid(),
  clientMutationId: z.string()
});

/**
 * GET /people
 * Fetch all people (excluding deleted status)
 */
router.get('/people', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const userPeople = await db
      .select()
      .from(people)
      .where(and(eq(people.userId, userId), or(eq(people.status, 'active'), eq(people.status, 'archived'))));

    const mapped = userPeople.map(p => ({
      ...p,
      name: p.displayName
    }));
    res.json(mapped);
  } catch (error) {
    logError('Error fetching people:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve people tags' });
  }
});

/**
 * POST /people
 * Create a new person
 */
router.post('/people', auditRoute('create_person', 'person'), validateRequest({ body: createPersonSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const { displayName, name, fullName, contextLabel, avatarReceiptId, status = 'active' } = req.body;
  const userId = req.user!.userId;
  const finalDisplayName = (displayName || name || '').trim();

  try {
    // Note: Multiple people can have the same name, so no uniqueness check!
    const [newPerson] = await db
      .insert(people)
      .values({
        userId,
        displayName: finalDisplayName,
        fullName: fullName || null,
        contextLabel: contextLabel || null,
        avatarReceiptId: avatarReceiptId || null,
        status,
      })
      .returning();

    await trackEvent(userId, 'person_created_from_composer', { personId: newPerson.id });

    const responseData = {
      ...newPerson,
      name: newPerson.displayName
    };

    res.status(201).json(responseData);
  } catch (error) {
    logError('Error creating person tag:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to create person tag' });
  }
});

/**
 * GET /people/:id
 * Retrieve aggregated profile for a person
 */
router.get('/people/:id', validateRequest({ params: idParamSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const personId = req.params.id as string;
  const userId = req.user!.userId;

  try {
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.userId, userId)))
      .limit(1);

    if (!person) {
      res.status(404).json({ error: 'NotFoundError', message: 'Person not found' });
      return;
    }

    // Fetch aliases
    const aliasesList = await db
      .select()
      .from(personAliases)
      .where(eq(personAliases.personId, personId));

    // Fetch roles
    const rolesList = await db
      .select()
      .from(personRoles)
      .where(eq(personRoles.personId, personId));

    // Fetch confirmed mentions
    const mentionsList = await db
      .select()
      .from(personMentions)
      .where(and(
        eq(personMentions.linkedPersonId, personId),
        eq(personMentions.status, 'confirmed')
      ));

    // Fetch parent notes
    const confirmedNotes: any[] = [];
    if (mentionsList.length > 0) {
      const noteIds = mentionsList.map(m => m.sourceId);
      const notesRows = await db
        .select()
        .from(notes)
        .where(and(
          eq(notes.userId, userId),
          inArray(notes.id, noteIds)
        ));
      // decrypt
      const { decrypt } = await import('../utils/crypto.js');
      confirmedNotes.push(...notesRows.map(n => ({ ...n, body: decrypt(n.body) })));
    }

    // Fetch possible mentions (likely/unresolved candidates linked to this person)
    const candidatesList = await db
      .select()
      .from(mentionCandidates)
      .where(and(
        eq(mentionCandidates.personId, personId),
        eq(mentionCandidates.state, 'active')
      ));

    const possibleMentions: any[] = [];
    if (candidatesList.length > 0) {
      const mentionIds = candidatesList.map(c => c.mentionId);
      const pm = await db
        .select()
        .from(personMentions)
        .where(and(
          inArray(personMentions.id, mentionIds),
          or(eq(personMentions.status, 'likely'), eq(personMentions.status, 'unresolved'))
        ));
      possibleMentions.push(...pm);
    }

    // Connected boxes
    const connectedBoxes: any[] = [];
    const boxIds = new Set<string>();
    confirmedNotes.forEach(n => boxIds.add(n.boxId));

    // Also include from boxPeople
    const bp = await db
      .select()
      .from(boxPeople)
      .where(eq(boxPeople.personId, personId));
    bp.forEach(item => boxIds.add(item.boxId));

    if (boxIds.size > 0) {
      const boxesRows = await db
        .select()
        .from(boxes)
        .where(and(eq(boxes.userId, userId), inArray(boxes.id, Array.from(boxIds))));
      connectedBoxes.push(...boxesRows);
    }

    res.json({
      person: { ...person, name: person.displayName },
      confirmedNotes,
      possibleMentions,
      aliases: aliasesList,
      roles: rolesList,
      connectedBoxes
    });
  } catch (error) {
    logError('Error fetching person aggregated profile:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve profile' });
  }
});

/**
 * PATCH /people/:id
 * Update person
 */
router.patch('/people/:id', auditRoute('update_person', 'person'), validateRequest({ params: idParamSchema, body: updatePersonSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const personId = req.params.id as string;
  const userId = req.user!.userId;
  const updates = req.body;
  const finalDisplayName = updates.displayName || updates.name;

  try {
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.userId, userId)))
      .limit(1);

    if (!person) {
      res.status(404).json({ error: 'NotFoundError', message: 'Person not found' });
      return;
    }

    const setFields: any = {
      ...(finalDisplayName !== undefined && { displayName: finalDisplayName.trim() }),
      ...(updates.fullName !== undefined && { fullName: updates.fullName }),
      ...(updates.contextLabel !== undefined && { contextLabel: updates.contextLabel }),
      ...(updates.avatarReceiptId !== undefined && { avatarReceiptId: updates.avatarReceiptId }),
      ...(updates.status !== undefined && { status: updates.status }),
      updatedAt: new Date()
    };

    if (updates.status === 'deleted') {
      setFields.deletedAt = new Date();
    }

    const [updated] = await db
      .update(people)
      .set(setFields)
      .where(eq(people.id, personId))
      .returning();

    res.json({
      ...updated,
      name: updated.displayName
    });
  } catch (error) {
    logError('Error updating person tag:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to update person tag' });
  }
});

/**
 * DELETE /people/:id
 * Delete person (soft delete)
 */
router.delete('/people/:id', auditRoute('delete_person', 'person'), validateRequest({ params: idParamSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const personId = req.params.id as string;
  const userId = req.user!.userId;

  try {
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.userId, userId)))
      .limit(1);

    if (!person) {
      res.status(404).json({ error: 'NotFoundError', message: 'Person not found' });
      return;
    }

    // Soft delete to keep record recoverable and preserve reference
    await db
      .update(people)
      .set({
        status: 'deleted',
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(people.id, personId));

    res.json({ success: true, message: 'Person tag deleted successfully' });
  } catch (error) {
    logError('Error deleting person tag:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to delete person tag' });
  }
});

/**
 * POST /people/picker-search
 * Autocomplete search for person tagging
 */
router.post('/people/picker-search', async (req: AuthenticatedRequest, res: Response) => {
  const { q = '', boxId } = req.body;
  const userId = req.user!.userId;
  const query = q.toLowerCase().trim();

  try {
    // Fetch active/archived people
    const peopleList = await db
      .select()
      .from(people)
      .where(and(eq(people.userId, userId), or(eq(people.status, 'active'), eq(people.status, 'archived'))));

    const aliasesList = await db
      .select()
      .from(personAliases)
      .where(eq(personAliases.userId, userId));

    const matching: any[] = [];
    for (const p of peopleList) {
      const matchName = p.displayName.toLowerCase().includes(query) || (p.fullName && p.fullName.toLowerCase().includes(query));
      const matchAlias = aliasesList.some(a => a.personId === p.id && a.rawValue.toLowerCase().includes(query));

      if (matchName || matchAlias) {
        matching.push(p);
      }
    }

    // Score & Rank: Box affinity
    const scoredList = [];
    for (const p of matching) {
      let score = 0;
      if (boxId) {
        // Check if person linked to box
        const [linked] = await db
          .select()
          .from(boxPeople)
          .where(and(eq(boxPeople.personId, p.id), eq(boxPeople.boxId, boxId)))
          .limit(1);
        if (linked) {
          score += 10;
        }

        // Check if has context label matching Work/etc.
        const [box] = await db.select().from(boxes).where(eq(boxes.id, boxId)).limit(1);
        if (box && p.contextLabel && box.name.toLowerCase().includes('work') && p.contextLabel.toLowerCase().includes('work')) {
          score += 5;
        }
      }

      scoredList.push({ person: p, score });
    }

    scoredList.sort((a, b) => b.score - a.score);

    res.json(scoredList.map(item => item.person));
  } catch (error) {
    logError('Error in picker search:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to query people picker' });
  }
});

// ── Aliases APIs ─────────────────────────────────────────────────────────────

/**
 * POST /people/:personId/aliases
 */
router.post('/people/:personId/aliases', validateRequest({ body: createAliasSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const personId = req.params.personId as string;
  const userId = req.user!.userId;
  const { rawValue, aliasType, matchMode, scopeType, scopeId, validFrom, validTo, confirmationStatus, autoConfirmAllowed = false } = req.body;

  try {
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.userId, userId)))
      .limit(1);

    if (!person) {
      res.status(404).json({ error: 'NotFoundError', message: 'Person not found' });
      return;
    }

    // Broad relationship context & possessive global scope checks:
    // Broad relationship terms ("mom", "mother", "boss", "dad") cannot default to global.
    const broadTerms = ['mom', 'mother', 'boss', 'dad', 'parent', 'manager'];
    const lowerVal = rawValue.toLowerCase().trim();
    if (broadTerms.includes(lowerVal) && scopeType === 'global') {
      res.status(400).json({ error: 'ValidationError', message: `Broad relationship term "${rawValue}" cannot be mapped globally.` });
      return;
    }

    // Fuzzy, phonetic, dictation, and misspelling matching cannot independently auto-confirm
    if (autoConfirmAllowed && (matchMode === 'fuzzy' || matchMode === 'phonetic' || aliasType === 'misspelling' || aliasType === 'dictation_variant')) {
      res.status(400).json({ error: 'ValidationError', message: 'Fuzzy/phonetic match mode and dictation/misspelling alias types are not eligible for auto-confirm.' });
      return;
    }

    const [alias] = await db
      .insert(personAliases)
      .values({
        userId,
        personId,
        rawValue,
        normalizedValue: normalizeText(rawValue),
        aliasType,
        matchMode,
        scopeType,
        scopeId: scopeId || null,
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        confirmationStatus,
        autoConfirmAllowed
      })
      .returning();

    await trackEvent(userId, 'alias_created', { personId, aliasId: alias.id });

    res.status(201).json(alias);
  } catch (error) {
    logError('Error creating alias:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to create alias' });
  }
});

/**
 * PATCH /people/:personId/aliases/:aliasId
 */
router.patch('/people/:personId/aliases/:aliasId', async (req: AuthenticatedRequest, res: Response) => {
  const personId = req.params.personId as string;
  const aliasId = req.params.aliasId as string;
  const userId = req.user!.userId;
  const updates = req.body;

  try {
    const [alias] = await db
      .select()
      .from(personAliases)
      .where(and(eq(personAliases.id, aliasId), eq(personAliases.personId, personId), eq(personAliases.userId, userId)))
      .limit(1);

    if (!alias) {
      res.status(404).json({ error: 'NotFoundError', message: 'Alias not found' });
      return;
    }

    // Apply validations if updated
    if (updates.autoConfirmAllowed && (updates.matchMode || alias.matchMode)) {
      const mode = updates.matchMode || alias.matchMode;
      const type = updates.aliasType || alias.aliasType;
      if (mode === 'fuzzy' || mode === 'phonetic' || type === 'misspelling' || type === 'dictation_variant') {
        res.status(400).json({ error: 'ValidationError', message: 'Cannot set autoConfirmAllowed to true for fuzzy/phonetic match modes or misspelling/dictation variant types.' });
        return;
      }
    }

    const [updated] = await db
      .update(personAliases)
      .set({
        ...(updates.rawValue !== undefined && { rawValue: updates.rawValue, normalizedValue: normalizeText(updates.rawValue) }),
        ...(updates.aliasType !== undefined && { aliasType: updates.aliasType }),
        ...(updates.matchMode !== undefined && { matchMode: updates.matchMode }),
        ...(updates.scopeType !== undefined && { scopeType: updates.scopeType }),
        ...(updates.scopeId !== undefined && { scopeId: updates.scopeId }),
        ...(updates.confirmationStatus !== undefined && { confirmationStatus: updates.confirmationStatus }),
        ...(updates.autoConfirmAllowed !== undefined && { autoConfirmAllowed: updates.autoConfirmAllowed }),
        updatedAt: new Date()
      })
      .where(eq(personAliases.id, aliasId))
      .returning();

    res.json(updated);
  } catch (error) {
    logError('Error updating alias:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to update alias' });
  }
});

/**
 * DELETE /people/:personId/aliases/:aliasId
 */
router.delete('/people/:personId/aliases/:aliasId', async (req: AuthenticatedRequest, res: Response) => {
  const personId = req.params.personId as string;
  const aliasId = req.params.aliasId as string;
  const userId = req.user!.userId;

  try {
    const [alias] = await db
      .select()
      .from(personAliases)
      .where(and(eq(personAliases.id, aliasId), eq(personAliases.personId, personId), eq(personAliases.userId, userId)))
      .limit(1);

    if (!alias) {
      res.status(404).json({ error: 'NotFoundError', message: 'Alias not found' });
      return;
    }

    await db.delete(personAliases).where(eq(personAliases.id, aliasId));
    res.json({ success: true, message: 'Alias deleted successfully' });
  } catch (error) {
    logError('Error deleting alias:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to delete alias' });
  }
});

// ── Mentions APIs ────────────────────────────────────────────────────────────

/**
 * GET /mentions/review
 */
router.get('/mentions/review', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    // List unresolved or likely mentions
    const list = await db
      .select()
      .from(personMentions)
      .where(and(
        eq(personMentions.userId, userId),
        or(eq(personMentions.status, 'unresolved'), eq(personMentions.status, 'likely'))
      ))
      .orderBy(desc(personMentions.createdAt));

    // Simple priority heuristic ranking
    // Priority: Recency + candidateConfidence
    const rankedList = list.sort((a, b) => {
      const scoreA = (a.candidateConfidence || 0) + (a.status === 'likely' ? 5 : 0);
      const scoreB = (b.candidateConfidence || 0) + (b.status === 'likely' ? 5 : 0);
      return scoreB - scoreA;
    });

    res.json(rankedList);
  } catch (error) {
    logError('Error fetching review mentions:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve review queue' });
  }
});

/**
 * POST /mentions/:mentionId/resolve
 */
router.post('/mentions/:mentionId/resolve', validateRequest({ body: resolveMentionSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const mentionId = req.params.mentionId as string;
  const userId = req.user!.userId;
  const { personId, expectedResolutionVersion, clientMutationId, autoConfirmRule } = req.body;

  try {
    const [mention] = await db
      .select()
      .from(personMentions)
      .where(and(eq(personMentions.id, mentionId), eq(personMentions.userId, userId)))
      .limit(1);

    if (!mention) {
      res.status(404).json({ error: 'NotFoundError', message: 'Mention not found' });
      return;
    }

    // Optimistic concurrency check
    if (mention.resolutionVersion !== expectedResolutionVersion) {
      res.status(409).json({
        error: 'ConflictError',
        message: 'Version conflict detected',
        expectedVersion: expectedResolutionVersion,
        currentVersion: mention.resolutionVersion
      });
      return;
    }

    // Verify target person
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.userId, userId)))
      .limit(1);

    if (!person) {
      res.status(404).json({ error: 'NotFoundError', message: 'Person not found' });
      return;
    }

    // Update mention status
    const [updatedMention] = await db
      .update(personMentions)
      .set({
        status: 'confirmed',
        linkedPersonId: personId,
        resolutionSource: 'manual_confirmation',
        resolutionVersion: mention.resolutionVersion + 1,
        updatedAt: new Date()
      })
      .where(eq(personMentions.id, mentionId))
      .returning();

    // Link in notePeople for compatibility
    await db
      .insert(notePeople)
      .values({
        noteId: mention.sourceId,
        personId
      })
      .onConflictDoNothing();

    // Insert resolution event
    await db.insert(mentionResolutionEvents).values({
      userId,
      mentionId,
      action: 'confirm_existing_person',
      previousPersonId: mention.linkedPersonId,
      nextPersonId: personId,
      source: 'person_detail',
      clientMutationId
    });

    // Create an exact alias rule if autoConfirmRule is selected
    if (autoConfirmRule) {
      await db.insert(personAliases).values({
        userId,
        personId,
        rawValue: mention.rawText,
        normalizedValue: normalizeText(mention.rawText),
        aliasType: 'name',
        matchMode: 'exact',
        scopeType: 'global',
        confirmationStatus: 'user_confirmed',
        autoConfirmAllowed: true
      });
    }

    await trackEvent(userId, 'mention_confirmed', { mentionId, personId });

    const result = { success: true, mention: updatedMention };
    res.json(result);
  } catch (error) {
    logError('Error resolving mention:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to resolve mention' });
  }
});

/**
 * POST /mentions/:mentionId/reassign
 */
router.post('/mentions/:mentionId/reassign', validateRequest({ body: reassignMentionSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const mentionId = req.params.mentionId as string;
  const userId = req.user!.userId;
  const { personId, expectedResolutionVersion, clientMutationId } = req.body;

  try {
    const [mention] = await db
      .select()
      .from(personMentions)
      .where(and(eq(personMentions.id, mentionId), eq(personMentions.userId, userId)))
      .limit(1);

    if (!mention) {
      res.status(404).json({ error: 'NotFoundError', message: 'Mention not found' });
      return;
    }

    // Optimistic concurrency check
    if (mention.resolutionVersion !== expectedResolutionVersion) {
      res.status(409).json({
        error: 'ConflictError',
        message: 'Version conflict detected',
        expectedVersion: expectedResolutionVersion,
        currentVersion: mention.resolutionVersion
      });
      return;
    }

    // Verify new person
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.userId, userId)))
      .limit(1);

    if (!person) {
      res.status(404).json({ error: 'NotFoundError', message: 'New person not found' });
      return;
    }

    const prevPersonId = mention.linkedPersonId;

    const [updatedMention] = await db
      .update(personMentions)
      .set({
        linkedPersonId: personId,
        status: 'confirmed',
        resolutionVersion: mention.resolutionVersion + 1,
        updatedAt: new Date()
      })
      .where(eq(personMentions.id, mentionId))
      .returning();

    // Log reassign event
    await db.insert(mentionResolutionEvents).values({
      userId,
      mentionId,
      action: 'reassign_person',
      previousPersonId: prevPersonId,
      nextPersonId: personId,
      source: 'person_detail',
      clientMutationId
    });

    // Update notePeople links
    if (prevPersonId) {
      await db.delete(notePeople).where(and(eq(notePeople.noteId, mention.sourceId), eq(notePeople.personId, prevPersonId)));
    }
    await db.insert(notePeople).values({ noteId: mention.sourceId, personId }).onConflictDoNothing();

    await trackEvent(userId, 'mention_reassigned', { mentionId, fromPersonId: prevPersonId, toPersonId: personId });

    const result = { success: true, mention: updatedMention };
    res.json(result);
  } catch (error) {
    logError('Error reassigning mention:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to reassign mention' });
  }
});

/**
 * POST /mentions/:mentionId/remove-link
 */
router.post('/mentions/:mentionId/remove-link', async (req: AuthenticatedRequest, res: Response) => {
  const mentionId = req.params.mentionId as string;
  const userId = req.user!.userId;

  try {
    const [mention] = await db
      .select()
      .from(personMentions)
      .where(and(eq(personMentions.id, mentionId), eq(personMentions.userId, userId)))
      .limit(1);

    if (!mention) {
      res.status(404).json({ error: 'NotFoundError', message: 'Mention not found' });
      return;
    }

    const prevPersonId = mention.linkedPersonId;

    const [updatedMention] = await db
      .update(personMentions)
      .set({
        linkedPersonId: null,
        status: 'unresolved',
        resolutionVersion: mention.resolutionVersion + 1,
        updatedAt: new Date()
      })
      .where(eq(personMentions.id, mentionId))
      .returning();

    // Log resolution event
    await db.insert(mentionResolutionEvents).values({
      userId,
      mentionId,
      action: 'remove_person_link',
      previousPersonId: prevPersonId,
      nextPersonId: null,
      source: 'person_detail',
      clientMutationId: 'direct_action'
    });

    if (prevPersonId) {
      await db.delete(notePeople).where(and(eq(notePeople.noteId, mention.sourceId), eq(notePeople.personId, prevPersonId)));
    }

    res.json(updatedMention);
  } catch (error) {
    logError('Error removing mention link:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to remove link' });
  }
});

/**
 * POST /mentions/:mentionId/mark-not-person
 */
router.post('/mentions/:mentionId/mark-not-person', async (req: AuthenticatedRequest, res: Response) => {
  const mentionId = req.params.mentionId as string;
  const userId = req.user!.userId;

  try {
    const [mention] = await db
      .select()
      .from(personMentions)
      .where(and(eq(personMentions.id, mentionId), eq(personMentions.userId, userId)))
      .limit(1);

    if (!mention) {
      res.status(404).json({ error: 'NotFoundError', message: 'Mention not found' });
      return;
    }

    const prevPersonId = mention.linkedPersonId;

    const [updatedMention] = await db
      .update(personMentions)
      .set({
        linkedPersonId: null,
        status: 'rejected',
        resolutionVersion: mention.resolutionVersion + 1,
        updatedAt: new Date()
      })
      .where(eq(personMentions.id, mentionId))
      .returning();

    await db.insert(mentionResolutionEvents).values({
      userId,
      mentionId,
      action: 'mark_not_person',
      previousPersonId: prevPersonId,
      nextPersonId: null,
      source: 'person_detail',
      clientMutationId: 'direct_action'
    });

    if (prevPersonId) {
      await db.delete(notePeople).where(and(eq(notePeople.noteId, mention.sourceId), eq(notePeople.personId, prevPersonId)));
    }

    await trackEvent(userId, 'mention_marked_not_person', { mentionId });

    res.json(updatedMention);
  } catch (error) {
    logError('Error marking as not a person:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to update mention' });
  }
});

/**
 * POST /mentions/:mentionId/defer
 */
router.post('/mentions/:mentionId/defer', async (req: AuthenticatedRequest, res: Response) => {
  const mentionId = req.params.mentionId as string;
  const userId = req.user!.userId;

  try {
    const [mention] = await db
      .select()
      .from(personMentions)
      .where(and(eq(personMentions.id, mentionId), eq(personMentions.userId, userId)))
      .limit(1);

    if (!mention) {
      res.status(404).json({ error: 'NotFoundError', message: 'Mention not found' });
      return;
    }

    await db.insert(mentionResolutionEvents).values({
      userId,
      mentionId,
      action: 'defer',
      previousPersonId: mention.linkedPersonId,
      nextPersonId: mention.linkedPersonId,
      source: 'review_queue',
      clientMutationId: 'direct_action'
    });

    res.json({ success: true, mention });
  } catch (error) {
    logError('Error deferring mention:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to defer mention' });
  }
});

// ── Clarifications APIs ──────────────────────────────────────────────────────

/**
 * GET /clarifications/review
 */
router.get('/clarifications/review', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;

  try {
    const list = await db
      .select()
      .from(clarificationQuestions)
      .where(and(
        eq(clarificationQuestions.userId, userId),
        eq(clarificationQuestions.status, 'pending')
      ))
      .orderBy(desc(clarificationQuestions.priorityScore));

    const result = [];
    for (const question of list) {
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
    logError('Error fetching clarifications review:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to retrieve clarifications review queue' });
  }
});

/**
 * POST /clarifications/:questionId/answer
 */
router.post('/clarifications/:questionId/answer', validateRequest({ body: answerClarificationSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const questionId = req.params.questionId as string;
  const userId = req.user!.userId;
  const { optionId, expectedQuestionVersion, clientMutationId } = req.body;

  try {
    const [question] = await db
      .select()
      .from(clarificationQuestions)
      .where(and(eq(clarificationQuestions.id, questionId), eq(clarificationQuestions.userId, userId)))
      .limit(1);

    if (!question) {
      res.status(404).json({ error: 'NotFoundError', message: 'Question not found' });
      return;
    }

    // Optimistic concurrency check
    if (question.version !== expectedQuestionVersion) {
      res.status(409).json({
        error: 'ConflictError',
        message: 'Question version conflict detected',
        expectedVersion: expectedQuestionVersion,
        currentVersion: question.version
      });
      return;
    }

    // Fetch chosen option
    const [chosenOption] = await db
      .select()
      .from(clarificationOptions)
      .where(and(eq(clarificationOptions.id, optionId), eq(clarificationOptions.questionId, questionId)))
      .limit(1);

    if (!chosenOption) {
      res.status(404).json({ error: 'NotFoundError', message: 'Chosen option not found' });
      return;
    }

    // Update question status
    await db
      .update(clarificationQuestions)
      .set({
        status: 'answered',
        version: question.version + 1,
        answeredAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(clarificationQuestions.id, questionId));

    // Apply the resolution outcome to the associated mentions
    for (const mentionId of question.mentionIds) {
      const [mention] = await db
        .select()
        .from(personMentions)
        .where(eq(personMentions.id, mentionId))
        .limit(1);

      if (!mention) continue;

      let nextPersonId = chosenOption.personId;
      let status: 'confirmed' | 'rejected' | 'unresolved' = 'unresolved';
      let action: any = 'leave_unresolved';

      if (chosenOption.optionType === 'existing_person') {
        status = 'confirmed';
        action = 'confirm_existing_person';
      } else if (chosenOption.optionType === 'create_new_person') {
        // Create new person using raw text of mention
        const [newPerson] = await db
          .insert(people)
          .values({
            userId,
            displayName: mention.rawText
          })
          .returning();
        nextPersonId = newPerson.id;
        status = 'confirmed';
        action = 'create_and_confirm_person';
      } else if (chosenOption.optionType === 'not_a_person') {
        status = 'rejected';
        action = 'mark_not_person';
        nextPersonId = null;
      }

      await db
        .update(personMentions)
        .set({
          status,
          linkedPersonId: nextPersonId,
          resolutionSource: 'clarification_answer',
          resolutionVersion: mention.resolutionVersion + 1,
          updatedAt: new Date()
        })
        .where(eq(personMentions.id, mentionId));

      if (nextPersonId) {
        await db
          .insert(notePeople)
          .values({ noteId: mention.sourceId, personId: nextPersonId })
          .onConflictDoNothing();
      }

      await db.insert(mentionResolutionEvents).values({
        userId,
        mentionId,
        action,
        previousPersonId: mention.linkedPersonId,
        nextPersonId,
        source: 'save_clarification',
        clientMutationId
      });
    }

    await trackEvent(userId, 'clarification_answered', { questionId });

    const result = { success: true };
    res.json(result);
  } catch (error) {
    logError('Error answering clarification question:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to submit answer' });
  }
});

/**
 * POST /clarifications/:questionId/defer
 */
router.post('/clarifications/:questionId/defer', async (req: AuthenticatedRequest, res: Response) => {
  const questionId = req.params.questionId as string;
  const userId = req.user!.userId;

  try {
    const [question] = await db
      .select()
      .from(clarificationQuestions)
      .where(and(eq(clarificationQuestions.id, questionId), eq(clarificationQuestions.userId, userId)))
      .limit(1);

    if (!question) {
      res.status(404).json({ error: 'NotFoundError', message: 'Question not found' });
      return;
    }

    await db
      .update(clarificationQuestions)
      .set({
        status: 'deferred',
        updatedAt: new Date()
      })
      .where(eq(clarificationQuestions.id, questionId));

    await trackEvent(userId, 'clarification_deferred', { questionId });

    res.json({ success: true });
  } catch (error) {
    logError('Error deferring clarification question:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to defer question' });
  }
});

/**
 * POST /clarifications/:questionId/dismiss
 */
router.post('/clarifications/:questionId/dismiss', async (req: AuthenticatedRequest, res: Response) => {
  const questionId = req.params.questionId as string;
  const userId = req.user!.userId;

  try {
    const [question] = await db
      .select()
      .from(clarificationQuestions)
      .where(and(eq(clarificationQuestions.id, questionId), eq(clarificationQuestions.userId, userId)))
      .limit(1);

    if (!question) {
      res.status(404).json({ error: 'NotFoundError', message: 'Question not found' });
      return;
    }

    await db
      .update(clarificationQuestions)
      .set({
        status: 'dismissed',
        updatedAt: new Date()
      })
      .where(eq(clarificationQuestions.id, questionId));

    await trackEvent(userId, 'clarification_dismissed', { questionId });

    res.json({ success: true });
  } catch (error) {
    logError('Error dismissing clarification question:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to dismiss question' });
  }
});

// ── Historical Review APIs ───────────────────────────────────────────────────

/**
 * GET /people/:personId/historical-candidates
 */
router.get('/people/:personId/historical-candidates', async (req: AuthenticatedRequest, res: Response) => {
  const personId = req.params.personId as string;
  const userId = req.user!.userId;

  try {
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.userId, userId)))
      .limit(1);

    if (!person) {
      res.status(404).json({ error: 'NotFoundError', message: 'Person not found' });
      return;
    }

    // Discover unresolved/likely mentions matching name or aliases
    const aliases = await db
      .select()
      .from(personAliases)
      .where(eq(personAliases.personId, personId));

    const matchStrings = new Set<string>();
    matchStrings.add(normalizeText(person.displayName));
    if (person.fullName) matchStrings.add(normalizeText(person.fullName));
    aliases.forEach(a => matchStrings.add(normalizeText(a.rawValue)));

    // Fetch all unresolved or likely mentions
    const unresolvedMentions = await db
      .select()
      .from(personMentions)
      .where(and(
        eq(personMentions.userId, userId),
        or(eq(personMentions.status, 'unresolved'), eq(personMentions.status, 'likely'))
      ));

    const candidateMentionIds: string[] = [];
    let highConfidenceCount = 0;
    let lowerConfidenceCount = 0;

    for (const mention of unresolvedMentions) {
      if (matchStrings.has(normalizeText(mention.rawText))) {
        candidateMentionIds.push(mention.id);
        highConfidenceCount++;
      } else if (isPhoneticallySimilar(mention.rawText, person.displayName)) {
        candidateMentionIds.push(mention.id);
        lowerConfidenceCount++;
      }
    }

    const responseData = {
      personId,
      candidateMentionIds,
      highConfidenceCount,
      lowerConfidenceCount
    };

    res.json(responseData);
  } catch (error) {
    logError('Error fetching historical candidates:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to query historical candidates' });
  }
});

/**
 * POST /people/:personId/historical-candidates/confirm
 */
router.post('/people/:personId/historical-candidates/confirm', async (req: AuthenticatedRequest, res: Response) => {
  const personId = req.params.personId as string;
  const userId = req.user!.userId;
  const { mentionIds, clientMutationId } = req.body;

  try {
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.userId, userId)))
      .limit(1);

    if (!person) {
      res.status(404).json({ error: 'NotFoundError', message: 'Person not found' });
      return;
    }

    if (!Array.isArray(mentionIds) || mentionIds.length === 0) {
      res.status(400).json({ error: 'ValidationError', message: 'No mentionIds provided' });
      return;
    }

    for (const mentionId of mentionIds) {
      const [mention] = await db
        .select()
        .from(personMentions)
        .where(and(eq(personMentions.id, mentionId), eq(personMentions.userId, userId)))
        .limit(1);

      if (!mention) continue;

      await db
        .update(personMentions)
        .set({
          status: 'confirmed',
          linkedPersonId: personId,
          resolutionSource: 'historical_review',
          resolutionVersion: mention.resolutionVersion + 1,
          updatedAt: new Date()
        })
        .where(eq(personMentions.id, mentionId));

      await db
        .insert(notePeople)
        .values({ noteId: mention.sourceId, personId })
        .onConflictDoNothing();

      await db.insert(mentionResolutionEvents).values({
        userId,
        mentionId,
        action: 'confirm_existing_person',
        previousPersonId: mention.linkedPersonId,
        nextPersonId: personId,
        source: 'historical_review',
        clientMutationId
      });
    }

    await trackEvent(userId, 'historical_mentions_confirmed', { count: mentionIds.length });

    const result = { success: true };
    res.json(result);
  } catch (error) {
    logError('Error confirming historical candidates:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to confirm candidates' });
  }
});

/**
 * POST /people/:personId/historical-candidates/reject
 */
router.post('/people/:personId/historical-candidates/reject', async (req: AuthenticatedRequest, res: Response) => {
  const personId = req.params.personId as string;
  const userId = req.user!.userId;
  const { mentionIds, clientMutationId } = req.body;

  try {
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.userId, userId)))
      .limit(1);

    if (!person) {
      res.status(404).json({ error: 'NotFoundError', message: 'Person not found' });
      return;
    }

    if (!Array.isArray(mentionIds) || mentionIds.length === 0) {
      res.status(400).json({ error: 'ValidationError', message: 'No mentionIds provided' });
      return;
    }

    for (const mentionId of mentionIds) {
      const [mention] = await db
        .select()
        .from(personMentions)
        .where(and(eq(personMentions.id, mentionId), eq(personMentions.userId, userId)))
        .limit(1);

      if (!mention) continue;

      await db
        .update(personMentions)
        .set({
          status: 'rejected',
          resolutionVersion: mention.resolutionVersion + 1,
          updatedAt: new Date()
        })
        .where(eq(personMentions.id, mentionId));

      await db.insert(mentionResolutionEvents).values({
        userId,
        mentionId,
        action: 'mark_not_person',
        previousPersonId: mention.linkedPersonId,
        nextPersonId: null,
        source: 'historical_review',
        clientMutationId
      });
    }

    const result = { success: true };
    res.json(result);
  } catch (error) {
    logError('Error rejecting historical candidates:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to reject candidates' });
  }
});

// ── Merge & Reversal APIs ────────────────────────────────────────────────────

/**
 * POST /people/merge
 */
router.post('/people/merge', validateRequest({ body: mergePeopleSchema }), async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const { survivingPersonId, mergedPersonId, clientMutationId } = req.body;

  if (survivingPersonId === mergedPersonId) {
    res.status(400).json({ error: 'ValidationError', message: 'Cannot merge a person into themselves' });
    return;
  }

  try {
    // 1. Verify surviving person
    const [surviving] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, survivingPersonId), eq(people.userId, userId)))
      .limit(1);

    // 2. Verify merged person
    const [merged] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, mergedPersonId), eq(people.userId, userId)))
      .limit(1);

    if (!surviving || !merged) {
      res.status(404).json({ error: 'NotFoundError', message: 'One or both of the target people was not found' });
      return;
    }

    // 3. Perform merge transactional logic
    // Set 30 days window for reversal
    const reversibleUntil = new Date();
    reversibleUntil.setDate(reversibleUntil.getDate() + 30);

    const mentionsToMove = await db
      .select()
      .from(personMentions)
      .where(and(
        eq(personMentions.linkedPersonId, mergedPersonId),
        eq(personMentions.userId, userId)
      ));
    const aliasesToMove = await db
      .select({ id: personAliases.id })
      .from(personAliases)
      .where(and(eq(personAliases.personId, mergedPersonId), eq(personAliases.userId, userId)));
    const rolesToMove = await db
      .select({ id: personRoles.id })
      .from(personRoles)
      .where(and(eq(personRoles.personId, mergedPersonId), eq(personRoles.userId, userId)));

    const [mergeRecord] = await db
      .insert(personMerges)
      .values({
        userId,
        survivingPersonId,
        mergedPersonId,
        status: 'completed',
        snapshotVersion: 1,
        movedMentionIds: mentionsToMove.map((mention) => mention.id),
        movedAliasIds: aliasesToMove.map((alias) => alias.id),
        movedRoleIds: rolesToMove.map((role) => role.id),
        reversibleUntil,
        completedAt: new Date()
      })
      .returning();

    // Loop through mentions linked to the merged person, reassign them to surviving person
    for (const mention of mentionsToMove) {
      await db
        .update(personMentions)
        .set({
          linkedPersonId: survivingPersonId,
          resolutionVersion: mention.resolutionVersion + 1,
          updatedAt: new Date()
        })
        .where(eq(personMentions.id, mention.id));

      // Log resolution event
      await db.insert(mentionResolutionEvents).values({
        userId,
        mentionId: mention.id,
        action: 'reassign_person',
        previousPersonId: mergedPersonId,
        nextPersonId: survivingPersonId,
        source: 'sync_resolution',
        clientMutationId
      });

      // Update notePeople links
      await db.delete(notePeople).where(and(eq(notePeople.noteId, mention.sourceId), eq(notePeople.personId, mergedPersonId)));
      await db.insert(notePeople).values({ noteId: mention.sourceId, personId: survivingPersonId }).onConflictDoNothing();
    }

    // Move aliases
    await db
      .update(personAliases)
      .set({ personId: survivingPersonId, updatedAt: new Date() })
      .where(eq(personAliases.personId, mergedPersonId));

    // Move roles
    await db
      .update(personRoles)
      .set({ personId: survivingPersonId, updatedAt: new Date() })
      .where(eq(personRoles.personId, mergedPersonId));

    // Soft delete merged person profile so it's hidden but recoverable
    await db
      .update(people)
      .set({
        status: 'deleted',
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(people.id, mergedPersonId));

    await trackEvent(userId, 'person_merge_completed', { mergeId: mergeRecord.id });

    const result = { success: true, mergeId: mergeRecord.id };
    res.status(201).json(result);
  } catch (error) {
    logError('Error during person merge:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to execute merge' });
  }
});

/**
 * POST /people/merges/:mergeId/reverse
 */
router.post('/people/merges/:mergeId/reverse', async (req: AuthenticatedRequest, res: Response) => {
  const mergeId = req.params.mergeId as string;
  const userId = req.user!.userId;
  const { clientMutationId } = req.body;

  try {
    const [merge] = await db
      .select()
      .from(personMerges)
      .where(and(eq(personMerges.id, mergeId), eq(personMerges.userId, userId)))
      .limit(1);

    if (!merge) {
      res.status(404).json({ error: 'NotFoundError', message: 'Merge record not found' });
      return;
    }

    if (merge.status === 'reversed') {
      res.status(400).json({ error: 'ValidationError', message: 'This merge has already been reversed' });
      return;
    }

    if (merge.snapshotVersion !== 1) {
      res.status(409).json({
        error: 'MERGE_REVERSAL_SNAPSHOT_MISSING',
        message: 'This legacy merge cannot be reversed automatically without risking unrelated People data.',
      });
      return;
    }

    const now = new Date();
    if (merge.reversibleUntil < now) {
      res.status(400).json({ error: 'ValidationError', message: 'Reversal window of 30 days has expired for this merge' });
      return;
    }

    // Reverse logic:
    // 1. Mark status as reversed
    await db
      .update(personMerges)
      .set({
        status: 'reversed',
        reversedAt: new Date()
      })
      .where(eq(personMerges.id, mergeId));

    // 2. Restore merged person profile
    await db
      .update(people)
      .set({
        status: 'active',
        deletedAt: null,
        updatedAt: new Date()
      })
      .where(eq(people.id, merge.mergedPersonId));

    // 3. Restore all mentions that were changed by this merge
    // Find resolution events logged for this merge
    const mentionsToRestore = merge.movedMentionIds.length > 0
      ? await db
        .select()
        .from(personMentions)
        .where(and(
          eq(personMentions.userId, userId),
          inArray(personMentions.id, merge.movedMentionIds),
        ))
      : [];

    for (const mention of mentionsToRestore) {
      if (mention.linkedPersonId === merge.survivingPersonId) {
        await db
          .update(personMentions)
          .set({
            linkedPersonId: merge.mergedPersonId,
            resolutionVersion: mention.resolutionVersion + 1,
            updatedAt: new Date()
          })
          .where(eq(personMentions.id, mention.id));

        // Restore the merged-person link. Preserve the survivor link if another
        // mention on the same Note still points to the survivor.
        await db.insert(notePeople).values({ noteId: mention.sourceId, personId: merge.mergedPersonId }).onConflictDoNothing();
        const remainingSurvivorMentions = await db
          .select({ id: personMentions.id })
          .from(personMentions)
          .where(and(
            eq(personMentions.userId, userId),
            eq(personMentions.sourceId, mention.sourceId),
            eq(personMentions.linkedPersonId, merge.survivingPersonId),
          ))
          .limit(1);
        if (remainingSurvivorMentions.length === 0) {
          await db.delete(notePeople).where(and(
            eq(notePeople.noteId, mention.sourceId),
            eq(notePeople.personId, merge.survivingPersonId),
          ));
        }
      }
    }

    if (merge.movedAliasIds.length > 0) {
      await db
        .update(personAliases)
        .set({ personId: merge.mergedPersonId, updatedAt: new Date() })
        .where(and(
          eq(personAliases.userId, userId),
          eq(personAliases.personId, merge.survivingPersonId),
          inArray(personAliases.id, merge.movedAliasIds),
        ));
    }

    if (merge.movedRoleIds.length > 0) {
      await db
        .update(personRoles)
        .set({ personId: merge.mergedPersonId, updatedAt: new Date() })
        .where(and(
          eq(personRoles.userId, userId),
          eq(personRoles.personId, merge.survivingPersonId),
          inArray(personRoles.id, merge.movedRoleIds),
        ));
    }

    await trackEvent(userId, 'person_merge_reversed', { mergeId });

    const result = { success: true };
    res.json(result);
  } catch (error) {
    logError('Error reversing merge:', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to reverse merge' });
  }
});

export default router;

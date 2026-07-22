import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import {
  notes,
  addMores,
  receipts,
  ocrTexts,
  boxes,
  people,
  personAliases,
  personMentions,
} from '../db/schema.js';
import { eq, and, isNull, inArray, or } from 'drizzle-orm';
import { decrypt } from '../utils/crypto.js';
import { logError } from '../utils/logger.js';
import { eligibilityMiddleware } from '../middleware/eligibility.js';

const router = Router();

// Apply auth middleware to all routes in this group
router.use(authMiddleware);
router.use(eligibilityMiddleware);

interface SearchMatch {
  resultType: 'note' | 'box';
  noteId: string | null;
  boxId: string;
  boxName: string;
  matchType: 'box_title' | 'note_body' | 'add_more' | 'ocr_text' | 'person';
  snippet: string;
  createdAt: string;
}

/**
 * GET /v1/search
 * Performs a global or box-scoped paginated search with snippet highlights over notes, add-mores, OCR, and people tags/mentions.
 */
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { q, boxId, page = '1', limit = '10' } = req.query;
  const userId = req.user!.userId;

  if (typeof q !== 'string' || q.trim().length === 0) {
    res.status(400).json({ error: 'ValidationError', message: 'Search query parameter q is required' });
    return;
  }

  const queryStr = q.toLowerCase().trim();
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10));

  try {
    // 1. Fetch boxes for mapping name
    const userBoxes = await db
      .select()
      .from(boxes)
      .where(and(eq(boxes.userId, userId), isNull(boxes.deletedAt)));

    const boxMap = new Map(userBoxes.map((b) => [b.id, b.name]));

    // 2. Fetch notes
    let notesConditions = and(eq(notes.userId, userId), isNull(notes.deletedAt));
    if (boxId) {
      notesConditions = and(notesConditions, eq(notes.boxId, boxId as string));
    }

    const allNotes = await db
      .select()
      .from(notes)
      .where(notesConditions);

    // 3. Fetch add-mores, OCR, people and mentions for index matching
    const noteIds = allNotes.map((n) => n.id);
    let allAddMores: any[] = [];
    let allOcrTexts: any[] = [];
    let allReceipts: any[] = [];

    const activePeople = await db
      .select()
      .from(people)
      .where(and(eq(people.userId, userId), or(eq(people.status, 'active'), eq(people.status, 'archived'))));

    const aliases = await db
      .select()
      .from(personAliases)
      .where(eq(personAliases.userId, userId));

    const userMentions = await db
      .select()
      .from(personMentions)
      .where(eq(personMentions.userId, userId));

    if (noteIds.length > 0) {
      allAddMores = await db
        .select()
        .from(addMores)
        .where(inArray(addMores.noteId, noteIds));

      allReceipts = await db
        .select()
        .from(receipts)
        .where(and(
          eq(receipts.userId, userId),
          inArray(receipts.noteId, noteIds),
          eq(receipts.scanStatus, 'clean'),
        ));

      const receiptIds = allReceipts.map((r) => r.id);
      if (receiptIds.length > 0) {
        allOcrTexts = await db
          .select()
          .from(ocrTexts)
          .where(inArray(ocrTexts.receiptId, receiptIds));
      }
    }

    const matches: SearchMatch[] = [];

    // Helper to generate context snippet
    const getSnippet = (text: string, index: number, queryLength: number): string => {
      const start = Math.max(0, index - 30);
      const end = Math.min(text.length, index + queryLength + 30);
      const before = text.substring(start, index);
      const match = text.substring(index, index + queryLength);
      const after = text.substring(index + queryLength, end);
      return `...${before}<mark>${match}</mark>${after}...`;
    };

    // Box titles are first-class results. A scoped search only returns the requested Box.
    for (const box of userBoxes) {
      if (boxId && box.id !== boxId) continue;
      const titleIndex = box.name.toLowerCase().indexOf(queryStr);
      if (titleIndex !== -1) {
        matches.push({
          resultType: 'box',
          noteId: null,
          boxId: box.id,
          boxName: box.name,
          matchType: 'box_title',
          snippet: getSnippet(box.name, titleIndex, queryStr.length),
          createdAt: box.createdAt.toISOString(),
        });
      }
    }

    // 4. In-memory decryption and search matching
    for (const note of allNotes) {
      const boxName = boxMap.get(note.boxId) || 'Unknown';
      const decryptedBody = decrypt(note.body);
      const lowerBody = decryptedBody.toLowerCase();

      // Check Note Body
      const bodyIdx = lowerBody.indexOf(queryStr);
      if (bodyIdx !== -1) {
        matches.push({
          resultType: 'note',
          noteId: note.id,
          boxId: note.boxId,
          boxName,
          matchType: 'note_body',
          snippet: getSnippet(decryptedBody, bodyIdx, queryStr.length),
          createdAt: note.createdAt.toISOString(),
        });
        continue;
      }

      // Check Add Mores
      let addMoreMatched = false;
      const noteAddMores = allAddMores.filter((a) => a.noteId === note.id);
      for (const block of noteAddMores) {
        const decryptedBlock = decrypt(block.body);
        const lowerBlock = decryptedBlock.toLowerCase();
        const blockIdx = lowerBlock.indexOf(queryStr);
        if (blockIdx !== -1) {
          matches.push({
            resultType: 'note',
            noteId: note.id,
            boxId: note.boxId,
            boxName,
            matchType: 'add_more',
            snippet: getSnippet(decryptedBlock, blockIdx, queryStr.length),
            createdAt: block.createdAt.toISOString(),
          });
          addMoreMatched = true;
          break;
        }
      }
      if (addMoreMatched) continue;

      // Check OCR Texts
      let ocrMatched = false;
      const noteReceipts = allReceipts.filter((r) => r.noteId === note.id);
      const noteReceiptIds = noteReceipts.map((r) => r.id);
      const noteOcrTexts = allOcrTexts.filter((o) => noteReceiptIds.includes(o.receiptId));

      for (const ocr of noteOcrTexts) {
        const decryptedOcr = decrypt(ocr.extractedText);
        const lowerOcr = decryptedOcr.toLowerCase();
        const ocrIdx = lowerOcr.indexOf(queryStr);
        if (ocrIdx !== -1) {
          matches.push({
            resultType: 'note',
            noteId: note.id,
            boxId: note.boxId,
            boxName,
            matchType: 'ocr_text',
            snippet: getSnippet(decryptedOcr, ocrIdx, queryStr.length),
            createdAt: ocr.createdAt.toISOString(),
          });
          ocrMatched = true;
          break;
        }
      }
      if (ocrMatched) continue;

      // Check Mentions & Confirmed People Names / Aliases linked to Note
      const noteMentions = userMentions.filter(m => m.sourceId === note.id);
      const matchMentionText = noteMentions.some(m => m.rawText.toLowerCase().includes(queryStr));

      let matchPersonText = false;
      for (const m of noteMentions) {
        if (m.linkedPersonId) {
          const p = activePeople.find(person => person.id === m.linkedPersonId);
          if (p) {
            if (p.displayName.toLowerCase().includes(queryStr) || (p.fullName && p.fullName.toLowerCase().includes(queryStr))) {
              matchPersonText = true;
              break;
            }
            const pAliases = aliases.filter(a => a.personId === p.id);
            if (pAliases.some(a => a.rawValue.toLowerCase().includes(queryStr))) {
              matchPersonText = true;
              break;
            }
          }
        }
      }

      if (matchMentionText || matchPersonText) {
        matches.push({
          resultType: 'note',
          noteId: note.id,
          boxId: note.boxId,
          boxName,
          matchType: 'person',
          snippet: `[Person Match]: ...${decryptedBody.substring(0, Math.min(decryptedBody.length, 60))}...`,
          createdAt: note.createdAt.toISOString()
        });
      }
    }

    // 5. Sort matches by date recency
    matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // 6. Paginate matches
    const totalCount = matches.length;
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedMatches = matches.slice(startIndex, startIndex + limitNum);
    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      success: true,
      query: q,
      totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages,
      results: paginatedMatches,
    });
  } catch (error) {
    logError('Search error', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to execute search' });
  }
});

/**
 * GET /v1/search/people
 * Searches for people (confirmed profile matches and unresolved mention groups)
 */
router.get('/people', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { q } = req.query;
  const userId = req.user!.userId;

  if (!q) {
    res.status(400).json({ error: 'ValidationError', message: 'Search query parameter q is required' });
    return;
  }

  const queryStr = (q as string).toLowerCase().trim();

  try {
    // 1. Fetch matching confirmed people
    const activePeople = await db
      .select()
      .from(people)
      .where(and(eq(people.userId, userId), or(eq(people.status, 'active'), eq(people.status, 'archived'))));

    const aliases = await db
      .select()
      .from(personAliases)
      .where(eq(personAliases.userId, userId));

    const matchedPeople = [];
    for (const p of activePeople) {
      const matchName = p.displayName.toLowerCase().includes(queryStr) || (p.fullName && p.fullName.toLowerCase().includes(queryStr));
      const matchAlias = aliases.some(a => a.personId === p.id && a.rawValue.toLowerCase().includes(queryStr));
      if (matchName || matchAlias) {
        // Count confirmed notes only
        const confirmedMentions = await db
          .select()
          .from(personMentions)
          .where(and(
            eq(personMentions.linkedPersonId, p.id),
            eq(personMentions.status, 'confirmed')
          ));

        // Count unique notes
        const uniqueNoteIds = new Set(confirmedMentions.map(m => m.sourceId));

        matchedPeople.push({
          kind: 'person' as const,
          personId: p.id,
          displayName: p.displayName,
          confirmedNoteCount: uniqueNoteIds.size
        });
      }
    }

    // 2. Fetch unresolved/likely raw text groups
    const unconfirmedMentions = await db
      .select()
      .from(personMentions)
      .where(and(
        eq(personMentions.userId, userId),
        or(eq(personMentions.status, 'unresolved'), eq(personMentions.status, 'likely')),
        isNull(personMentions.linkedPersonId)
      ));

    const groupMap = new Map<string, number>();
    for (const mention of unconfirmedMentions) {
      if (mention.rawText.toLowerCase().includes(queryStr)) {
        const norm = mention.normalizedText || mention.rawText.toLowerCase().trim();
        groupMap.set(norm, (groupMap.get(norm) || 0) + 1);
      }
    }

    const matchedUnresolved = Array.from(groupMap.entries()).map(([norm, count]) => ({
      kind: 'unresolved_mention_group' as const,
      normalizedText: norm,
      mentionCount: count
    }));

    res.json([...matchedPeople, ...matchedUnresolved]);
  } catch (error) {
    logError('People search error', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to search people' });
  }
});

export default router;

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { notes, boxes, dismissedPatterns, people, personMentions } from '../db/schema.js';
import { eq, and, isNull, gt, or } from 'drizzle-orm';
import { decrypt } from '../utils/crypto.js';
import { auditRoute } from '../middleware/audit.js';
import { trackEvent } from '../utils/telemetry.js';
import { eligibilityMiddleware } from '../middleware/eligibility.js';
import { logError } from '../utils/logger.js';
import { getEffectiveEntitlement } from '../services/entitlementResolver.js';

const router = Router();

// Apply auth middleware to all routes in this group
router.use(authMiddleware);
router.use(eligibilityMiddleware);

// Define patterns to scan for
const MINIMIZATION_TRIGGERS = [
  'just a joke',
  'overthinking',
  'fine',
  'no big deal',
  'making a big deal',
  'nothing',
  'making things up',
];

const BOUNDARY_TRIGGERS = [
  'shouting',
  'yell',
  'crossed line',
  'crossed the line',
  'disrespect',
  'interrupted',
  'screaming',
];

/**
 * GET /v1/patterns
 * Scans user notes and returns active pattern insights (excluding dismissed/snoozed)
 */
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.userId;
  const now = new Date();

  try {
    const entitlement = await getEffectiveEntitlement(userId);
    if (!entitlement.capabilities.patterns) {
      res.status(402).json({
        error: 'PaymentRequired',
        message: 'Patterns analysis is a premium feature. Please upgrade to Pro to unlock.',
      });
      return;
    }

    // 1. Fetch active notes
    const activeNotes = await db
      .select()
      .from(notes)
      .where(and(eq(notes.userId, userId), isNull(notes.deletedAt)));

    const activeBoxes = await db
      .select()
      .from(boxes)
      .where(and(eq(boxes.userId, userId), isNull(boxes.deletedAt)));
    const boxNames = new Map(activeBoxes.map((box) => [box.id, box.name]));
    const activeNoteIds = new Set(activeNotes.map((note) => note.id));

    const activePeople = await db
      .select()
      .from(people)
      .where(and(eq(people.userId, userId), eq(people.status, 'active')));

    // 2. Fetch dismissed or snoozed patterns
    const activeDismissals = await db
      .select()
      .from(dismissedPatterns)
      .where(
        and(
          eq(dismissedPatterns.userId, userId),
          or(
            isNull(dismissedPatterns.snoozedUntil),
            gt(dismissedPatterns.snoozedUntil, now)
          )
        )
      );

    const blockedPatternKeys = new Set(activeDismissals.map(d => d.patternKey));

    // 3. Scan decrypted notes for matches
    const minimizationMatches: any[] = [];
    const boundaryMatches: any[] = [];

    for (const note of activeNotes) {
      const decryptedBody = decrypt(note.body);
      const lowerBody = decryptedBody.toLowerCase();

      // Check Minimization
      for (const trigger of MINIMIZATION_TRIGGERS) {
        if (lowerBody.includes(trigger)) {
          const index = lowerBody.indexOf(trigger);
          const start = Math.max(0, index - 30);
          const end = Math.min(decryptedBody.length, index + trigger.length + 30);
          const quote = `...${decryptedBody.substring(start, end).trim()}...`;

          minimizationMatches.push({
            quote,
            date: note.createdAt.toISOString(),
            noteId: note.id,
            boxName: boxNames.get(note.boxId) || 'Unknown Box',
          });
          break; // Avoid duplicate matches for same note
        }
      }

      // Check Boundary Dispute
      for (const trigger of BOUNDARY_TRIGGERS) {
        if (lowerBody.includes(trigger)) {
          const index = lowerBody.indexOf(trigger);
          const start = Math.max(0, index - 30);
          const end = Math.min(decryptedBody.length, index + trigger.length + 30);
          const quote = `...${decryptedBody.substring(start, end).trim()}...`;

          boundaryMatches.push({
            quote,
            date: note.createdAt.toISOString(),
            noteId: note.id,
            boxName: boxNames.get(note.boxId) || 'Unknown Box',
          });
          break; // Avoid duplicate matches for same note
        }
      }
    }

    // 4. Assemble insights
    const insights: any[] = [];

    if (minimizationMatches.length >= 2 && !blockedPatternKeys.has('minimization')) {
      insights.push({
        key: 'minimization',
        name: 'Minimization Pattern',
        description: 'I noticed repeated wording such as "just a joke," "overthinking," or "no big deal" in your saved Notes.',
        matches: minimizationMatches.slice(0, 3),
      });
    }

    if (boundaryMatches.length >= 2 && !blockedPatternKeys.has('boundary_dispute')) {
      insights.push({
        key: 'boundary_dispute',
        name: 'Boundary Disputes',
        description: 'I noticed repeated descriptions of shouting, interruptions, or crossed lines in your saved Notes.',
        matches: boundaryMatches.slice(0, 3),
      });
    }

    // 5. Scan personMentions for Person-based patterns
    const mentions = await db
      .select()
      .from(personMentions)
      .where(eq(personMentions.userId, userId));
    const activeMentions = mentions.filter((mention) => activeNoteIds.has(mention.sourceId));

    const confirmedCountMap = new Map<string, { name: string; noteIds: Set<string> }>();
    const unconfirmedCountMap = new Map<string, Set<string>>();

    for (const m of activeMentions) {
      if (m.status === 'confirmed' && m.linkedPersonId) {
        const p = activePeople.find(person => person.id === m.linkedPersonId);
        if (p) {
          const entry = confirmedCountMap.get(p.id) || { name: p.displayName, noteIds: new Set<string>() };
          entry.noteIds.add(m.sourceId);
          confirmedCountMap.set(p.id, entry);
        }
      } else if (m.status === 'unresolved' || m.status === 'likely') {
        const name = m.rawText;
        const noteIds = unconfirmedCountMap.get(name) || new Set<string>();
        noteIds.add(m.sourceId);
        unconfirmedCountMap.set(name, noteIds);
      }
    }

    // Add confirmed person patterns (at least 3 notes)
    for (const [personId, entry] of confirmedCountMap.entries()) {
      if (entry.noteIds.size >= 3 && !blockedPatternKeys.has(`person_pattern_${personId}`)) {
        insights.push({
          key: `person_pattern_${personId}`,
          name: `Interaction Pattern: ${entry.name}`,
          description: `I noticed ${entry.noteIds.size} saved Notes connected to ${entry.name}.`,
          matches: activeMentions
            .filter(m => m.linkedPersonId === personId && m.status === 'confirmed')
            .filter((m, index, values) => values.findIndex((other) => other.sourceId === m.sourceId) === index)
            .slice(0, 3)
            .map(m => {
              const sourceNote = activeNotes.find((note) => note.id === m.sourceId)!;
              return {
                noteId: m.sourceId,
                date: sourceNote.createdAt.toISOString(),
                boxName: boxNames.get(sourceNote.boxId) || 'Unknown Box',
                quote: `...${m.contextBefore || ''}${m.rawText}${m.contextAfter || ''}...`,
              };
            })
        });
      }
    }

    // Add unconfirmed/unresolved patterns (uncertainty statement only!)
    for (const [name, noteIds] of unconfirmedCountMap.entries()) {
      if (noteIds.size >= 3 && !blockedPatternKeys.has(`person_pattern_uncertain_${name.toLowerCase()}`)) {
        insights.push({
          key: `person_pattern_uncertain_${name.toLowerCase()}`,
          name: `Unresolved Name Mentions`,
          description: `The name “${name}” appears in several Notes but has not been connected to a Person.`,
          matches: activeMentions
            .filter(m => m.rawText === name && (m.status === 'unresolved' || m.status === 'likely'))
            .filter((m, index, values) => values.findIndex((other) => other.sourceId === m.sourceId) === index)
            .slice(0, 3)
            .map(m => {
              const sourceNote = activeNotes.find((note) => note.id === m.sourceId)!;
              return {
                noteId: m.sourceId,
                date: sourceNote.createdAt.toISOString(),
                boxName: boxNames.get(sourceNote.boxId) || 'Unknown Box',
                quote: `...${m.contextBefore || ''}${m.rawText}${m.contextAfter || ''}...`,
              };
            })
        });
      }
    }

    await trackEvent(userId, 'patterns_surface_opened');

    res.json(insights);
  } catch (error) {
    logError('Error scanning patterns', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to scan patterns' });
  }
});

/**
 * POST /v1/patterns/dismiss
 * Permanently dismisses a specific pattern insight
 */
router.post('/dismiss', auditRoute('dismiss_pattern', 'compliance'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { patternKey } = req.body;
  const userId = req.user!.userId;

  if (!patternKey) {
    res.status(400).json({ error: 'ValidationError', message: 'patternKey is required' });
    return;
  }

  try {
    const entitlement = await getEffectiveEntitlement(userId);
    if (!entitlement.capabilities.patterns) {
      res.status(402).json({
        error: 'PaymentRequired',
        message: 'Patterns analysis is a premium feature. Please upgrade to Pro to unlock.',
      });
      return;
    }
    const [entry] = await db
      .insert(dismissedPatterns)
      .values({
        userId,
        patternKey,
        dismissedAt: new Date(),
      })
      .returning();

    await trackEvent(userId, 'proactive_pattern_dismissed', { patternKey });

    res.json({ success: true, message: 'Pattern dismissed successfully', entry });
  } catch (error) {
    logError('Pattern dismissal error', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to dismiss pattern' });
  }
});

/**
 * POST /v1/patterns/snooze
 * Snoozes a specific pattern insight for 7 days
 */
router.post('/snooze', auditRoute('snooze_pattern', 'compliance'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { patternKey } = req.body;
  const userId = req.user!.userId;

  if (!patternKey) {
    res.status(400).json({ error: 'ValidationError', message: 'patternKey is required' });
    return;
  }

  try {
    const entitlement = await getEffectiveEntitlement(userId);
    if (!entitlement.capabilities.patterns) {
      res.status(402).json({
        error: 'PaymentRequired',
        message: 'Patterns analysis is a premium feature. Please upgrade to Pro to unlock.',
      });
      return;
    }
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + 7);

    const [entry] = await db
      .insert(dismissedPatterns)
      .values({
        userId,
        patternKey,
        snoozedUntil,
        dismissedAt: new Date(),
      })
      .returning();

    await trackEvent(userId, 'proactive_pattern_dismissed', { patternKey, snoozed: true });

    res.json({ success: true, message: 'Pattern snoozed successfully for 7 days', entry });
  } catch (error) {
    logError('Pattern snooze error', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to snooze pattern' });
  }
});

export default router;

import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { notes, dismissedPatterns, addMores, entitlements, people, personMentions } from '../db/schema.js';
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
          });
          break; // Avoid duplicate matches for same note
        }
      }
    }

    // 4. Assemble insights
    const insights: any[] = [];

    if (minimizationMatches.length > 0 && !blockedPatternKeys.has('minimization')) {
      insights.push({
        key: 'minimization',
        name: 'Minimization Pattern',
        description: 'You have recorded notes where situations are described as "just a joke," "overthinking," or "no big deal." This shape represents minimization.',
        matches: minimizationMatches,
      });
    }

    if (boundaryMatches.length > 0 && !blockedPatternKeys.has('boundary_dispute')) {
      insights.push({
        key: 'boundary_dispute',
        name: 'Boundary Disputes',
        description: 'You have recorded instances containing descriptions of shouting, interruptions, or crossed lines. This represents potential boundary conflicts.',
        matches: boundaryMatches,
      });
    }

    // 5. Scan personMentions for Person-based patterns
    const mentions = await db
      .select()
      .from(personMentions)
      .where(eq(personMentions.userId, userId));

    const confirmedCountMap = new Map<string, { name: string; count: number }>();
    const unconfirmedCountMap = new Map<string, number>();

    for (const m of mentions) {
      if (m.status === 'confirmed' && m.linkedPersonId) {
        const p = activePeople.find(person => person.id === m.linkedPersonId);
        if (p) {
          const entry = confirmedCountMap.get(p.id) || { name: p.displayName, count: 0 };
          entry.count++;
          confirmedCountMap.set(p.id, entry);
        }
      } else if (m.status === 'unresolved' || m.status === 'likely') {
        const name = m.rawText;
        unconfirmedCountMap.set(name, (unconfirmedCountMap.get(name) || 0) + 1);
      }
    }

    // Add confirmed person patterns (at least 3 notes)
    for (const [personId, entry] of confirmedCountMap.entries()) {
      if (entry.count >= 3 && !blockedPatternKeys.has(`person_pattern_${personId}`)) {
        insights.push({
          key: `person_pattern_${personId}`,
          name: `Interaction Pattern: ${entry.name}`,
          description: `${entry.name} repeatedly did this. You have ${entry.count} recorded interactions.`,
          matches: mentions
            .filter(m => m.linkedPersonId === personId && m.status === 'confirmed')
            .map(m => ({ noteId: m.sourceId, date: m.createdAt.toISOString(), quote: `...${m.rawText}...` }))
        });
      }
    }

    // Add unconfirmed/unresolved patterns (uncertainty statement only!)
    for (const [name, count] of unconfirmedCountMap.entries()) {
      if (count >= 3 && !blockedPatternKeys.has(`person_pattern_uncertain_${name.toLowerCase()}`)) {
        insights.push({
          key: `person_pattern_uncertain_${name.toLowerCase()}`,
          name: `Unresolved Name Mentions`,
          description: `The name “${name}” appears in several Notes but has not been connected to a Person.`,
          matches: mentions
            .filter(m => m.rawText === name && (m.status === 'unresolved' || m.status === 'likely'))
            .map(m => ({ noteId: m.sourceId, date: m.createdAt.toISOString(), quote: `...${m.rawText}...` }))
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
 * Snoozes a specific pattern insight for 30 days
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
    snoozedUntil.setDate(snoozedUntil.getDate() + 30); // 30-day snooze window

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

    res.json({ success: true, message: 'Pattern snoozed successfully for 30 days', entry });
  } catch (error) {
    logError('Pattern snooze error', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to snooze pattern' });
  }
});

export default router;

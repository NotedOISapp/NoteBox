import { Router, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { foundingFeedback, userCampaignStates } from '../db/schema.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { eligibilityMiddleware } from '../middleware/eligibility.js';

const router = Router();
router.use(eligibilityMiddleware);

/**
 * POST /v1/founding-feedback
 * Submits structured founding user feedback.
 * Records extensionFeedbackCompletedAt in userCampaignStates.
 * Note: Submitting feedback DOES NOT directly grant an entitlement.
 */
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      whatWorked,
      whatWasConfusing,
      bugsEncountered,
      mostValuableFeature,
      whatAlmostMadeYouStop,
      mayContactForFollowUp,
    } = req.body || {};

    if (
      typeof whatWorked !== 'string' ||
      typeof whatWasConfusing !== 'string' ||
      typeof bugsEncountered !== 'string' ||
      typeof mostValuableFeature !== 'string' ||
      typeof whatAlmostMadeYouStop !== 'string'
    ) {
      res.status(400).json({
        error: 'InvalidRequest',
        message: 'All feedback fields must be non-empty strings.',
      });
      return;
    }

    const submittedAt = new Date();

    // 1. Insert structured feedback record
    const [feedbackRecord] = await db
      .insert(foundingFeedback)
      .values({
        userId,
        whatWorked,
        whatWasConfusing,
        bugsEncountered,
        mostValuableFeature,
        whatAlmostMadeYouStop,
        mayContactForFollowUp: Boolean(mayContactForFollowUp),
        submittedAt,
      })
      .returning();

    // 2. Record extensionFeedbackCompletedAt in userCampaignStates
    const [existingState] = await db
      .select()
      .from(userCampaignStates)
      .where(eq(userCampaignStates.userId, userId));

    if (existingState) {
      await db
        .update(userCampaignStates)
        .set({
          extensionFeedbackCompletedAt: submittedAt,
          updatedAt: submittedAt,
        })
        .where(eq(userCampaignStates.userId, userId));
    } else {
      await db.insert(userCampaignStates).values({
        userId,
        foundingCampaignEligible: true,
        extensionFeedbackCompletedAt: submittedAt,
      });
    }

    res.status(200).json({
      status: 'success',
      feedbackId: feedbackRecord.id,
      extensionFeedbackCompletedAt: submittedAt.toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'FEEDBACK_SUBMISSION_FAILED',
      message: err.message || 'Failed to submit founding feedback',
    });
  }
});

export default router;

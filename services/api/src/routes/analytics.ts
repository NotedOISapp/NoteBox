import { Router, Response } from 'express';
import { AuthenticatedRequest, authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { analyticsEvents } from '../db/schema.js';
import { trackEvent } from '../utils/telemetry.js';
import { logError } from '../utils/logger.js';
import { eligibilityMiddleware } from '../middleware/eligibility.js';

const router = Router();
router.use(authMiddleware);
router.use(eligibilityMiddleware);

/**
 * POST /v1/analytics
 * Record a backend analytics event.
 * Body: { event_type: string, properties?: Record<string, any> }
 */
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { event_type, properties } = req.body;
  const userId = req.user!.userId;

  if (!event_type) {
    res.status(400).json({ error: 'ValidationError', message: 'event_type is required' });
    return;
  }

  try {
    await db
      .insert(analyticsEvents)
      .values({
        userId,
        eventType: event_type,
        properties: properties ? JSON.stringify(properties) : null,
      });

    await trackEvent(userId, 'analytics_event_recorded', { event_type });
    res.status(201).json({ success: true });
  } catch (error) {
    logError('Analytics endpoint error', error);
    res.status(500).json({ error: 'InternalServerError', message: 'Failed to record analytics event' });
  }
});

export default router;

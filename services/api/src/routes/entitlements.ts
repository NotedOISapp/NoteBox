import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { getEffectiveEntitlement } from '../services/entitlementResolver.js';

const router = Router();

/**
 * GET /v1/entitlements/me
 * Returns the canonical EffectiveEntitlement object for the authenticated user.
 */
router.get('/me', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const entitlement = await getEffectiveEntitlement(userId);
    res.status(200).json(entitlement);
  } catch (err: any) {
    res.status(500).json({
      error: 'ENTITLEMENT_SYNC_FAILED',
      message: err.message || 'Failed to resolve entitlements',
    });
  }
});

export default router;

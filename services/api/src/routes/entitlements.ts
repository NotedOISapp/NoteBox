import { Router, Response } from 'express';
import { eq } from 'drizzle-orm';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { getEffectiveEntitlement } from '../services/entitlementResolver.js';

const router = Router();

/**
 * GET /v1/entitlements/me
 * Returns the canonical EffectiveEntitlement object and the stable StoreKit
 * account-binding token for the authenticated user.
 */
router.get('/me', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const [entitlement, [account]] = await Promise.all([
      getEffectiveEntitlement(userId),
      db.select({ appAccountToken: users.appAccountToken })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
    ]);

    if (!account) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }

    res.set('Cache-Control', 'no-store');
    res.status(200).json({
      ...entitlement,
      appAccountToken: account.appAccountToken.toLowerCase(),
    });
  } catch (err: any) {
    res.status(500).json({
      error: 'ENTITLEMENT_SYNC_FAILED',
      message: err.message || 'Failed to resolve entitlements',
    });
  }
});

export default router;

import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { claimPromotionalTransactions, MAX_STOREKIT_TRANSACTIONS_PER_REQUEST } from '../services/storekitClaimService.js';
import { syncStoreKitTransactions } from '../services/storekitSyncService.js';

const router = Router();

/**
 * POST /v1/storekit/transactions/claim
 * Authenticated endpoint to claim StoreKit 2 promotional transactions.
 */
router.post('/claim', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { signedTransactions } = req.body || {};
    if (!Array.isArray(signedTransactions)) {
      res.status(400).json({ error: 'InvalidRequest', message: 'signedTransactions must be an array of JWS strings' });
      return;
    }

    // Limit batch size
    if (signedTransactions.length > MAX_STOREKIT_TRANSACTIONS_PER_REQUEST) {
      res.status(400).json({ error: 'InvalidRequest', message: `Maximum ${MAX_STOREKIT_TRANSACTIONS_PER_REQUEST} signed transactions per claim request` });
      return;
    }

    const result = await claimPromotionalTransactions({
      authenticatedUserId: userId,
      signedTransactions,
    });

    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({
      error: 'ENTITLEMENT_SYNC_FAILED',
      message: err.message || 'Failed to claim StoreKit transactions',
    });
  }
});

/**
 * POST /v1/storekit/transactions/sync
 * Authenticated, idempotent endpoint to synchronize StoreKit transaction history.
 */
router.post('/sync', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const signedTransactions = Array.isArray(req.body?.signedTransactions)
      ? req.body.signedTransactions
      : [];

    if (signedTransactions.length > MAX_STOREKIT_TRANSACTIONS_PER_REQUEST) {
      res.status(400).json({ error: 'InvalidRequest', message: `Maximum ${MAX_STOREKIT_TRANSACTIONS_PER_REQUEST} signed transactions per sync request` });
      return;
    }

    const claimResult = await syncStoreKitTransactions({
      authenticatedUserId: userId,
      signedTransactions,
    });

    res.status(200).json(claimResult);
  } catch (err: any) {
    res.status(500).json({
      error: 'ENTITLEMENT_SYNC_FAILED',
      message: err.message || 'Failed to sync StoreKit transactions',
    });
  }
});

export default router;

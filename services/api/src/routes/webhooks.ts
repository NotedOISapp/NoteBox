import { Router, Request, Response } from 'express';
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  storekitTransactions,
  promotionalGrants,
  appStoreNotifications,
  storekitTransactionTombstones,
} from '../db/schema.js';
import { verifyAppStoreNotification } from '../services/storekitVerification.js';

const router = Router();
const PROCESSING_LEASE_MS = 5 * 60 * 1000;

router.post('/apple/app-store', async (req: Request, res: Response): Promise<void> => {
  const signedPayload = req.body?.signedPayload ?? req.body?.signedResponseBody;
  if (typeof signedPayload !== 'string' || !signedPayload) {
    res.status(400).json({ error: 'INVALID_REQUEST', message: 'Missing signedPayload.' });
    return;
  }

  let verified;
  try {
    verified = await verifyAppStoreNotification(signedPayload);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : 'STOREKIT_NOTIFICATION_INVALID',
      message: 'Apple notification verification failed.',
    });
    return;
  }

  const { decodedNotification, verifiedTransaction } = verified;
  const notificationUuid = String(decodedNotification.notificationUUID);
  const notificationType = String(decodedNotification.notificationType);
  const subtype = decodedNotification.subtype ? String(decodedNotification.subtype) : null;
  const environment = decodedNotification.data?.environment
    ? String(decodedNotification.data.environment)
    : verifiedTransaction?.environment ?? 'Sandbox';
  const receivedAt = new Date();

  // Durable receipt exists independently of the processing transaction.
  await db.insert(appStoreNotifications).values({
    notificationUuid,
    notificationType,
    subtype,
    environment,
    receivedAt,
    processingStatus: 'received',
    signedDate: decodedNotification.signedDate
      ? new Date(decodedNotification.signedDate)
      : null,
  }).onConflictDoNothing();

  try {
    const outcome = await db.transaction(async (tx) => {
      const [notification] = await tx.select().from(appStoreNotifications)
        .where(eq(appStoreNotifications.notificationUuid, notificationUuid))
        .for('update');
      if (!notification) throw new Error('NOTIFICATION_LEDGER_MISSING');

      if (notification.processingStatus === 'processed' || notification.processingStatus === 'ignored') {
        return notification.processingStatus;
      }
      const now = new Date();
      if (
        notification.processingStatus === 'processing'
        && notification.processingLeaseExpiresAt
        && notification.processingLeaseExpiresAt > now
      ) {
        return 'leased';
      }

      await tx.update(appStoreNotifications).set({
        processingStatus: 'processing',
        processingStartedAt: now,
        processingLeaseExpiresAt: new Date(now.getTime() + PROCESSING_LEASE_MS),
        lastAttemptAt: now,
        attemptCount: sql`${appStoreNotifications.attemptCount} + 1`,
        failureCode: null,
      }).where(eq(appStoreNotifications.id, notification.id));

      const actionable = notificationType === 'REVOKE'
        || notificationType === 'REFUND'
        || subtype === 'REFUND';
      if (!actionable) {
        await tx.update(appStoreNotifications).set({
          processingStatus: 'ignored',
          processedAt: new Date(),
          processingLeaseExpiresAt: null,
        }).where(eq(appStoreNotifications.id, notification.id));
        return 'ignored';
      }
      if (!verifiedTransaction) throw new Error('STOREKIT_NOTIFICATION_TRANSACTION_REQUIRED');

      const conditions = [eq(storekitTransactions.transactionId, verifiedTransaction.transactionId)];
      if (verifiedTransaction.originalTransactionId) {
        conditions.push(eq(
          storekitTransactions.originalTransactionId,
          verifiedTransaction.originalTransactionId,
        ));
      }
      const matchingTransactions = await tx.select().from(storekitTransactions)
        .where(or(...conditions));

      if (matchingTransactions.length > 0) {
        const transactionIds = matchingTransactions.map((transaction) => transaction.transactionId);
        await tx.update(storekitTransactions).set({
          verificationStatus: 'revoked',
          revokedAt: verifiedTransaction.revokedAt ?? new Date(),
          revocationReason: notificationType,
          updatedAt: new Date(),
        }).where(or(...conditions));
        await tx.update(promotionalGrants).set({
          status: 'revoked',
          revokedAt: verifiedTransaction.revokedAt ?? new Date(),
          updatedAt: new Date(),
        }).where(inArray(promotionalGrants.transactionId, transactionIds));
      } else {
        await tx.insert(storekitTransactionTombstones).values({
          transactionId: verifiedTransaction.transactionId,
          originalTransactionId: verifiedTransaction.originalTransactionId,
          productId: verifiedTransaction.productId,
          environment: verifiedTransaction.environment,
          transactionStatus: 'revoked',
          effectiveAt: verifiedTransaction.revokedAt ?? new Date(),
          updatedAt: new Date(),
        }).onConflictDoUpdate({
          target: storekitTransactionTombstones.transactionId,
          set: {
            transactionStatus: 'revoked',
            effectiveAt: verifiedTransaction.revokedAt ?? new Date(),
            updatedAt: new Date(),
          },
        });
      }

      await tx.update(appStoreNotifications).set({
        processingStatus: 'processed',
        processedAt: new Date(),
        processingLeaseExpiresAt: null,
        failureCode: null,
      }).where(eq(appStoreNotifications.id, notification.id));
      return 'processed';
    });

    if (outcome === 'leased') {
      res.status(200).json({ status: 'processing' });
      return;
    }
    res.status(200).json({ status: outcome, notificationId: notificationUuid });
  } catch (error) {
    await db.update(appStoreNotifications).set({
      processingStatus: 'failed',
      processingLeaseExpiresAt: null,
      failureCode: error instanceof Error ? error.message.slice(0, 255) : 'PROCESSING_ERROR',
    }).where(eq(appStoreNotifications.notificationUuid, notificationUuid));
    res.status(500).json({
      error: 'WEBHOOK_PROCESSING_FAILED',
      message: error instanceof Error ? error.message : 'Webhook processing failed.',
    });
  }
});

export default router;

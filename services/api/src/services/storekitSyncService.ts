import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  storekitTransactions,
  storekitTransactionTombstones,
  subscriptions,
  users,
} from '../db/schema.js';
import {
  ClaimResultItem,
  ClaimStoreKitResult,
  claimPromotionalTransactions,
  MAX_STOREKIT_TRANSACTIONS_PER_REQUEST,
} from './storekitClaimService.js';
import { getEffectiveEntitlement } from './entitlementResolver.js';
import {
  isPromotionalProductId,
  VerifiedStoreKitTransaction,
  verifyStoreKitTransaction,
} from './storekitVerification.js';

type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'refunded';

function subscriptionStatus(transaction: VerifiedStoreKitTransaction, now: Date): SubscriptionStatus {
  if (transaction.revokedAt) return 'refunded';
  if (!transaction.expiresAt || transaction.expiresAt <= now) return 'expired';
  return transaction.offerDiscountType === 'FREE_TRIAL' ? 'trial' : 'active';
}

function subscriptionResult(
  transaction: VerifiedStoreKitTransaction,
  status: ClaimResultItem['status'],
  errorCode?: string,
): ClaimResultItem {
  return {
    transactionId: transaction.transactionId,
    productId: transaction.productId,
    grantType: null,
    status,
    ...(errorCode ? { errorCode } : {}),
  };
}

async function synchronizeVerifiedSubscription(
  authenticatedUserId: string,
  transaction: VerifiedStoreKitTransaction,
): Promise<ClaimResultItem> {
  if (transaction.productKind !== 'subscription' || !transaction.originalTransactionId || !transaction.expiresAt) {
    return subscriptionResult(transaction, 'rejected', 'STOREKIT_TRANSACTION_INVALID');
  }
  const originalTransactionId = transaction.originalTransactionId;
  const expiresAt = transaction.expiresAt;

  let result: ClaimResultItem = subscriptionResult(transaction, 'rejected', 'ENTITLEMENT_SYNC_FAILED');
  const now = new Date();

  try {
    await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users)
      .where(eq(users.id, authenticatedUserId))
      .for('update');
    if (!user) throw new Error('USER_NOT_FOUND');

    const [tombstone] = await tx.select().from(storekitTransactionTombstones)
      .where(eq(storekitTransactionTombstones.transactionId, transaction.transactionId))
      .limit(1);
    if (tombstone) {
      result = subscriptionResult(transaction, 'rejected', 'STOREKIT_TRANSACTION_REVOKED');
      return;
    }

    if (
      transaction.appAccountToken
      && transaction.appAccountToken !== user.appAccountToken.toLowerCase()
    ) {
      result = subscriptionResult(transaction, 'rejected', 'STOREKIT_TRANSACTION_OWNERSHIP_MISMATCH');
      return;
    }

    const existingOriginalTransactions = await tx.select({ userId: storekitTransactions.userId })
      .from(storekitTransactions)
      .where(eq(storekitTransactions.originalTransactionId, originalTransactionId));
    if (existingOriginalTransactions.some((row) => row.userId && row.userId !== authenticatedUserId)) {
      result = subscriptionResult(transaction, 'rejected', 'STOREKIT_TRANSACTION_OWNERSHIP_MISMATCH');
      return;
    }

    const [existingTransaction] = await tx.select().from(storekitTransactions)
      .where(eq(storekitTransactions.transactionId, transaction.transactionId))
      .for('update');
    if (existingTransaction) {
      result = existingTransaction.userId === authenticatedUserId
        ? subscriptionResult(transaction, 'already_claimed')
        : subscriptionResult(transaction, 'rejected', 'STOREKIT_TRANSACTION_OWNERSHIP_MISMATCH');
      return;
    }

    const status = subscriptionStatus(transaction, now);
    await tx.insert(storekitTransactions).values({
      transactionId: transaction.transactionId,
      originalTransactionId,
      userId: authenticatedUserId,
      productId: transaction.productId,
      appAccountToken: transaction.appAccountToken ?? user.appAccountToken,
      purchaseDate: transaction.purchaseDate,
      originalPurchaseDate: transaction.originalPurchaseDate,
      environment: transaction.environment,
      signedTransactionHash: transaction.signedTransactionHash,
      verificationStatus: transaction.revokedAt ? 'revoked' : 'verified',
      revokedAt: transaction.revokedAt,
      revocationReason: transaction.revocationReason,
      claimedAt: new Date(),
    });

    const [existingSubscription] = await tx.select().from(subscriptions).where(and(
      eq(subscriptions.userId, authenticatedUserId),
      eq(subscriptions.platform, 'apple'),
      eq(subscriptions.originalTxnId, originalTransactionId),
    )).limit(1).for('update');

    const shouldApply = !existingSubscription
      || expiresAt >= existingSubscription.currentPeriodEnd;
    if (existingSubscription && shouldApply) {
      await tx.update(subscriptions).set({
        productId: transaction.productId,
        status,
        currentPeriodEnd: expiresAt,
        updatedAt: new Date(),
      }).where(eq(subscriptions.id, existingSubscription.id));
    } else if (!existingSubscription) {
      await tx.insert(subscriptions).values({
        userId: authenticatedUserId,
        platform: 'apple',
        productId: transaction.productId,
        status,
        originalTxnId: originalTransactionId,
        currentPeriodEnd: expiresAt,
        autoRenew: true,
      });
    }

    result = status === 'active' || status === 'trial'
      ? subscriptionResult(transaction, 'created')
      : subscriptionResult(
          transaction,
          'rejected',
          status === 'refunded' ? 'STOREKIT_TRANSACTION_REVOKED' : 'STOREKIT_SUBSCRIPTION_EXPIRED',
        );
    });
  } catch (error: any) {
    if (error?.code === '23505') {
      const [existing] = await db.select().from(storekitTransactions)
        .where(eq(storekitTransactions.transactionId, transaction.transactionId))
        .limit(1);
      result = existing?.userId === authenticatedUserId
        ? subscriptionResult(transaction, 'already_claimed')
        : subscriptionResult(transaction, 'rejected', 'STOREKIT_TRANSACTION_OWNERSHIP_MISMATCH');
    } else {
      result = subscriptionResult(transaction, 'rejected', 'ENTITLEMENT_SYNC_FAILED');
    }
  }

  return result;
}

export async function syncStoreKitTransactions(input: {
  authenticatedUserId: string;
  signedTransactions: string[];
}): Promise<ClaimStoreKitResult> {
  const { authenticatedUserId, signedTransactions } = input;
  if (!Array.isArray(signedTransactions)) throw new Error('INVALID_SYNC_INPUT');
  if (signedTransactions.length > MAX_STOREKIT_TRANSACTIONS_PER_REQUEST) {
    throw new Error('TRANSACTION_BATCH_LIMIT_EXCEEDED');
  }

  const promotionalSignedTransactions: string[] = [];
  const verifiedSubscriptions: VerifiedStoreKitTransaction[] = [];
  const rejectedItems: ClaimResultItem[] = [];

  for (const signedTransaction of [...new Set(signedTransactions)]) {
    try {
      const verified = await verifyStoreKitTransaction(signedTransaction);
      if (isPromotionalProductId(verified.productId)) {
        promotionalSignedTransactions.push(signedTransaction);
      } else {
        verifiedSubscriptions.push(verified);
      }
    } catch (error) {
      rejectedItems.push({
        transactionId: null,
        productId: null,
        grantType: null,
        status: 'rejected',
        errorCode: error instanceof Error ? error.message : 'STOREKIT_TRANSACTION_INVALID',
      });
    }
  }

  verifiedSubscriptions.sort((left, right) => left.purchaseDate.getTime() - right.purchaseDate.getTime());
  const subscriptionResults: ClaimResultItem[] = [];
  for (const transaction of verifiedSubscriptions) {
    subscriptionResults.push(await synchronizeVerifiedSubscription(authenticatedUserId, transaction));
  }

  const promotionalResult = promotionalSignedTransactions.length > 0
    ? await claimPromotionalTransactions({ authenticatedUserId, signedTransactions: promotionalSignedTransactions })
    : null;

  return {
    claimed: [
      ...(promotionalResult?.claimed ?? []),
      ...subscriptionResults,
      ...rejectedItems,
    ],
    entitlement: await getEffectiveEntitlement(authenticatedUserId),
  };
}

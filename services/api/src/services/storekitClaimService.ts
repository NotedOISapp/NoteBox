import { and, eq, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  users,
  storekitTransactions,
  promotionalGrants,
  userCampaignStates,
  foundingCampaignConfigs,
  creatorRewardApprovals,
  storekitTransactionTombstones,
} from '../db/schema.js';
import {
  verifyStoreKitTransaction,
  PROMOTIONAL_PRODUCT_MAP,
  VerifiedStoreKitTransaction,
  PromotionalGrantType,
  isPromotionalProductId,
} from './storekitVerification.js';
import { getEffectiveEntitlement, EffectiveEntitlement } from './entitlementResolver.js';
import { addCalendarMonthsClamped } from '../utils/dateUtils.js';

export const MAX_STOREKIT_TRANSACTIONS_PER_REQUEST = 20;
export const MAX_CREATOR_BONUS_MONTHS_PER_USER = 12;

export interface ClaimResultItem {
  transactionId: string | null;
  productId: string | null;
  grantType: PromotionalGrantType | null;
  status: 'created' | 'already_claimed' | 'rejected';
  errorCode?: string;
}

export interface ClaimStoreKitResult {
  claimed: ClaimResultItem[];
  entitlement: EffectiveEntitlement;
}

function rejected(
  transaction: VerifiedStoreKitTransaction,
  grantType: PromotionalGrantType,
  errorCode: string,
): ClaimResultItem {
  return {
    transactionId: transaction.transactionId,
    productId: transaction.productId,
    grantType,
    status: 'rejected',
    errorCode,
  };
}

export async function claimPromotionalTransactions(input: {
  authenticatedUserId: string;
  signedTransactions: string[];
}): Promise<ClaimStoreKitResult> {
  const { authenticatedUserId, signedTransactions } = input;
  if (!Array.isArray(signedTransactions)) throw new Error('INVALID_CLAIM_INPUT');
  if (signedTransactions.length > MAX_STOREKIT_TRANSACTIONS_PER_REQUEST) {
    throw new Error('TRANSACTION_BATCH_LIMIT_EXCEEDED');
  }

  const verifiedItems: Array<{
    verified: VerifiedStoreKitTransaction | null;
    error: string | null;
    grantType: PromotionalGrantType | null;
  }> = [];

  for (const signedTransaction of [...new Set(signedTransactions)]) {
    try {
      const verified = await verifyStoreKitTransaction(signedTransaction);
      if (!isPromotionalProductId(verified.productId)) {
        verifiedItems.push({
          verified: null,
          error: 'STOREKIT_PROMOTIONAL_PRODUCT_REQUIRED',
          grantType: null,
        });
        continue;
      }
      verifiedItems.push({
        verified,
        error: null,
        grantType: PROMOTIONAL_PRODUCT_MAP[verified.productId].grantType,
      });
    } catch (error) {
      verifiedItems.push({
        verified: null,
        error: error instanceof Error ? error.message : 'STOREKIT_TRANSACTION_INVALID',
        grantType: null,
      });
    }
  }

  const order: Record<PromotionalGrantType, number> = {
    founding_launch: 1,
    founding_extension: 2,
    creator_bonus: 3,
  };
  verifiedItems.sort((left, right) =>
    (left.grantType ? order[left.grantType] : 99) - (right.grantType ? order[right.grantType] : 99));

  const results: ClaimResultItem[] = [];

  for (const item of verifiedItems) {
    if (!item.verified || !item.grantType) {
      results.push({
        transactionId: null,
        productId: null,
        grantType: null,
        status: 'rejected',
        errorCode: item.error ?? 'STOREKIT_TRANSACTION_INVALID',
      });
      continue;
    }

    const transaction = item.verified;
    if (!isPromotionalProductId(transaction.productId)) {
      results.push({
        transactionId: transaction.transactionId,
        productId: transaction.productId,
        grantType: null,
        status: 'rejected',
        errorCode: 'STOREKIT_PROMOTIONAL_PRODUCT_REQUIRED',
      });
      continue;
    }
    const product = PROMOTIONAL_PRODUCT_MAP[transaction.productId];
    const grantType = product.grantType;

    if (transaction.revokedAt) {
      results.push(rejected(transaction, grantType, 'STOREKIT_TRANSACTION_REVOKED'));
      continue;
    }

    let result: ClaimResultItem | null = null;

    try {
      await db.transaction(async (tx) => {
        const [user] = await tx.select().from(users)
          .where(eq(users.id, authenticatedUserId)).for('update');
        if (!user) throw new Error('USER_NOT_FOUND');

        const tombstoneConditions = [eq(storekitTransactionTombstones.transactionId, transaction.transactionId)];
        if (transaction.originalTransactionId) {
          tombstoneConditions.push(eq(
            storekitTransactionTombstones.originalTransactionId,
            transaction.originalTransactionId,
          ));
        }
        const [tombstone] = await tx.select().from(storekitTransactionTombstones)
          .where(or(...tombstoneConditions)).limit(1);
        if (tombstone) {
          result = rejected(transaction, grantType, 'STOREKIT_TRANSACTION_REVOKED');
          return;
        }

        if (
          transaction.appAccountToken
          && transaction.appAccountToken.toLowerCase() !== user.appAccountToken.toLowerCase()
        ) {
          result = rejected(transaction, grantType, 'STOREKIT_TRANSACTION_OWNERSHIP_MISMATCH');
          return;
        }

        const [existingTransaction] = await tx.select().from(storekitTransactions)
          .where(eq(storekitTransactions.transactionId, transaction.transactionId)).for('update');
        if (existingTransaction) {
          result = existingTransaction.userId === authenticatedUserId
            ? {
                transactionId: transaction.transactionId,
                productId: transaction.productId,
                grantType,
                status: 'already_claimed',
              }
            : rejected(transaction, grantType, 'STOREKIT_TRANSACTION_OWNERSHIP_MISMATCH');
          return;
        }

        const campaignConfigs = await tx.select().from(foundingCampaignConfigs)
          .where(eq(foundingCampaignConfigs.productId, transaction.productId));
        if (campaignConfigs.length !== 1) {
          result = rejected(transaction, grantType, 'CAMPAIGN_CONFIG_MISSING');
          return;
        }
        const campaign = campaignConfigs[0];
        if (
          campaign.campaignId !== product.campaignId
          || campaign.campaignType !== product.campaignType
        ) {
          result = rejected(transaction, grantType, 'CAMPAIGN_CONFIG_CONFLICT');
          return;
        }
        if (!campaign.isActive) {
          result = rejected(transaction, grantType, 'FOUNDING_CAMPAIGN_INACTIVE');
          return;
        }
        if (campaign.redemptionStartsAt && transaction.purchaseDate < campaign.redemptionStartsAt) {
          result = rejected(transaction, grantType, 'CAMPAIGN_REDEMPTION_NOT_STARTED');
          return;
        }
        if (transaction.purchaseDate > campaign.redemptionEndsAt) {
          result = rejected(transaction, grantType, 'CAMPAIGN_REDEMPTION_EXPIRED');
          return;
        }

        let approvalId: string | null = null;
        if (grantType === 'founding_launch' || grantType === 'founding_extension') {
          if (user.createdAt < campaign.signupStartsAt || user.createdAt > campaign.signupEndsAt) {
            result = rejected(transaction, grantType, 'FOUNDING_SIGNUP_WINDOW_EXPIRED');
            return;
          }
          if (transaction.purchaseDate > addCalendarMonthsClamped(user.createdAt, 3)) {
            result = rejected(transaction, grantType, 'FOUNDING_PURCHASE_DEADLINE_EXCEEDED');
            return;
          }

          const [state] = await tx.select().from(userCampaignStates)
            .where(eq(userCampaignStates.userId, authenticatedUserId)).for('update');
          if (campaign.requiresExplicitEligibility && !state?.foundingCampaignEligible) {
            result = rejected(transaction, grantType, 'FOUNDING_CAMPAIGN_NOT_ELIGIBLE');
            return;
          }

          const grants = await tx.select().from(promotionalGrants).where(and(
            eq(promotionalGrants.userId, authenticatedUserId),
            sql`${promotionalGrants.status} <> 'revoked'`,
          ));

          if (grantType === 'founding_launch') {
            if (grants.some((grant) =>
              grant.grantType === 'founding_launch' && grant.campaignId === product.campaignId)) {
              result = rejected(transaction, grantType, 'FOUNDING_LAUNCH_ALREADY_REDEEMED');
              return;
            }
          } else {
            const requiredLaunchCampaignId = 'requiredLaunchCampaignId' in product
              ? product.requiredLaunchCampaignId
              : null;
            if (!requiredLaunchCampaignId || !grants.some((grant) =>
              grant.grantType === 'founding_launch'
              && grant.campaignId === requiredLaunchCampaignId)) {
              result = rejected(transaction, grantType, 'FOUNDING_LAUNCH_REQUIRED');
              return;
            }
            if (campaign.requiresExtensionInvite && !state?.extensionInviteIssuedAt) {
              result = rejected(transaction, grantType, 'FOUNDING_EXTENSION_INVITE_REQUIRED');
              return;
            }
            if (campaign.requiresFoundingFeedback && !state?.extensionFeedbackCompletedAt) {
              result = rejected(transaction, grantType, 'FOUNDING_FEEDBACK_REQUIRED');
              return;
            }
            if (grants.some((grant) =>
              grant.grantType === 'founding_extension' && grant.campaignId === product.campaignId)) {
              result = rejected(transaction, grantType, 'FOUNDING_EXTENSION_ALREADY_REDEEMED');
              return;
            }
          }
        } else {
          const creatorGrants = await tx.select().from(promotionalGrants).where(and(
            eq(promotionalGrants.userId, authenticatedUserId),
            eq(promotionalGrants.grantType, 'creator_bonus'),
            sql`${promotionalGrants.status} <> 'revoked'`,
          ));
          if (creatorGrants.length >= MAX_CREATOR_BONUS_MONTHS_PER_USER) {
            result = rejected(transaction, grantType, 'CREATOR_REWARD_LIMIT_REACHED');
            return;
          }

          if (campaign.requiresCreatorApproval) {
            const [approval] = await tx.select().from(creatorRewardApprovals).where(and(
              eq(creatorRewardApprovals.userId, authenticatedUserId),
              eq(creatorRewardApprovals.approvedMonths, 1),
              eq(creatorRewardApprovals.status, 'code_issued'),
            )).orderBy(creatorRewardApprovals.codeIssuedAt).limit(1).for('update');
            if (!approval) {
              result = rejected(transaction, grantType, 'CREATOR_REWARD_NOT_APPROVED');
              return;
            }
            approvalId = approval.id;
            await tx.update(creatorRewardApprovals).set({
              status: 'redeemed',
              updatedAt: new Date(),
            }).where(and(
              eq(creatorRewardApprovals.id, approval.id),
              eq(creatorRewardApprovals.status, 'code_issued'),
            ));
          }
        }

        await tx.insert(storekitTransactions).values({
          transactionId: transaction.transactionId,
          originalTransactionId: transaction.originalTransactionId,
          userId: authenticatedUserId,
          productId: transaction.productId,
          appAccountToken: transaction.appAccountToken ?? user.appAccountToken,
          purchaseDate: transaction.purchaseDate,
          originalPurchaseDate: transaction.originalPurchaseDate,
          environment: transaction.environment,
          signedTransactionHash: transaction.signedTransactionHash,
          verificationStatus: 'verified',
          claimedAt: new Date(),
        });

        await tx.insert(promotionalGrants).values({
          userId: authenticatedUserId,
          campaignId: product.campaignId,
          grantType,
          transactionId: transaction.transactionId,
          approvalId,
          durationMonths: product.durationMonths,
          status: 'active',
          redeemedAt: transaction.purchaseDate,
        });

        result = {
          transactionId: transaction.transactionId,
          productId: transaction.productId,
          grantType,
          status: 'created',
        };
      });
    } catch (error: any) {
      if (error?.code === '23505') {
        const constraint = String(error.constraint ?? '');
        if (constraint === 'promotional_one_launch_per_campaign') {
          result = rejected(transaction, grantType, 'FOUNDING_LAUNCH_ALREADY_REDEEMED');
        } else if (constraint === 'promotional_one_extension_per_campaign') {
          result = rejected(transaction, grantType, 'FOUNDING_EXTENSION_ALREADY_REDEEMED');
        } else if (constraint === 'promotional_grant_approval_id_unique') {
          result = rejected(transaction, grantType, 'CREATOR_APPROVAL_ALREADY_CONSUMED');
        } else if (constraint === 'storekit_transactions_transaction_id_unique') {
          const [existing] = await db.select().from(storekitTransactions)
            .where(eq(storekitTransactions.transactionId, transaction.transactionId)).limit(1);
          result = existing?.userId === authenticatedUserId
            ? {
                transactionId: transaction.transactionId,
                productId: transaction.productId,
                grantType,
                status: 'already_claimed',
              }
            : rejected(transaction, grantType, 'STOREKIT_TRANSACTION_OWNERSHIP_MISMATCH');
        } else {
          result = rejected(transaction, grantType, 'STOREKIT_TRANSACTION_CONFLICT');
        }
      } else {
        result = rejected(
          transaction,
          grantType,
          error instanceof Error ? error.message : 'ENTITLEMENT_SYNC_FAILED',
        );
      }
    }

    results.push(result ?? rejected(transaction, grantType, 'ENTITLEMENT_SYNC_FAILED'));
  }

  return {
    claimed: results,
    entitlement: await getEffectiveEntitlement(authenticatedUserId),
  };
}

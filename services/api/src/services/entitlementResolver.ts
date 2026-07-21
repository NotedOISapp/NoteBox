import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  users,
  subscriptions,
  entitlements,
  promotionalGrants,
  userCampaignStates,
  storekitTransactions,
} from '../db/schema.js';
import { calculatePromotionalTimeline, PromotionalTimeline } from './promotionalTimeline.js';

export type EffectiveTier = 'developer' | 'paid' | 'trial' | 'promotional' | 'free';

export interface EffectiveEntitlement {
  tier: EffectiveTier;
  hasProAccess: boolean;
  source: 'developer' | 'storekit_subscription' | 'trial' | 'founding_campaign' | 'creator_campaign' | 'free';
  accessStartsAt: string | null;
  accessEndsAt: string | null;
  foundingCampaign: {
    eligible: boolean;
    launchRedeemed: boolean;
    extensionRedeemed: boolean;
    extensionScheduled: boolean;
    campaignAnchorAt: string | null;
    baseAccessEndsAt: string | null;
    creatorBonusMonths: number;
    finalAccessEndsAt: string | null;
  } | null;
  capabilities: {
    unlimitedBoxes: boolean;
    unlimitedNotes: boolean;
    editing: boolean;
    patterns: boolean;
    export: boolean;
    allPerspectiveControls: boolean;
  };
}

export const PRO_CAPABILITIES = {
  unlimitedBoxes: true,
  unlimitedNotes: true,
  editing: true,
  patterns: true,
  export: true,
  allPerspectiveControls: true,
};

export const FREE_CAPABILITIES = {
  unlimitedBoxes: false,
  unlimitedNotes: false,
  editing: false,
  patterns: false,
  export: false,
  allPerspectiveControls: false,
};

function laterIso(...values: Array<Date | string | null | undefined>): string | null {
  const dates = values
    .filter((value): value is Date | string => Boolean(value))
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()));
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString();
}

export async function getEffectiveEntitlement(
  userId: string,
  now: Date = new Date(),
  executor: any = db,
): Promise<EffectiveEntitlement> {
  const [userRecord] = await executor.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRecord) throw new Error('USER_NOT_FOUND');

  const [campaignState] = await executor.select().from(userCampaignStates)
    .where(eq(userCampaignStates.userId, userId)).limit(1);
  const [entitlementRecord] = await executor.select().from(entitlements)
    .where(eq(entitlements.userId, userId)).limit(1);

  if (userRecord.role === 'developer') {
    return {
      tier: 'developer',
      hasProAccess: true,
      source: 'developer',
      accessStartsAt: userRecord.createdAt.toISOString(),
      accessEndsAt: null,
      foundingCampaign: null,
      capabilities: PRO_CAPABILITIES,
    };
  }

  const activeSubs = await executor.select().from(subscriptions).where(eq(subscriptions.userId, userId));
  const activePaidSub = activeSubs.find((subscription: any) =>
    (subscription.status === 'active' || subscription.status === 'grace')
    && new Date(subscription.currentPeriodEnd) > now,
  );
  const activeTrialSub = activeSubs.find((subscription: any) =>
    subscription.status === 'trial' && new Date(subscription.currentPeriodEnd) > now,
  );

  const isLegacyPaid = entitlementRecord?.plan === 'paid'
    && (!entitlementRecord.validUntil || new Date(entitlementRecord.validUntil) > now);
  const isLegacyTrial = entitlementRecord?.plan === 'trial'
    && Boolean(entitlementRecord.validUntil)
    && new Date(entitlementRecord.validUntil) > now;

  const paidExpiration = activePaidSub?.currentPeriodEnd
    ?? (isLegacyPaid ? entitlementRecord?.validUntil ?? null : null);
  const trialExpiration = activeTrialSub?.currentPeriodEnd
    ?? (isLegacyTrial ? entitlementRecord?.validUntil ?? null : null);
  const existingProExpirationIso = laterIso(paidExpiration, trialExpiration);

  const grantRows = await executor
    .select({
      grantType: promotionalGrants.grantType,
      durationMonths: promotionalGrants.durationMonths,
      status: promotionalGrants.status,
      redeemedAt: promotionalGrants.redeemedAt,
      revokedAt: promotionalGrants.revokedAt,
      purchaseDate: storekitTransactions.purchaseDate,
    })
    .from(promotionalGrants)
    .leftJoin(storekitTransactions, eq(storekitTransactions.transactionId, promotionalGrants.transactionId))
    .where(eq(promotionalGrants.userId, userId));

  const campaignAnchorAt = campaignState?.foundingCampaignAnchorAt ?? userRecord.createdAt;
  const timeline: PromotionalTimeline = calculatePromotionalTimeline({
    campaignAnchorAt,
    grants: grantRows.map((grant: any) => ({
      grantType: grant.grantType,
      durationMonths: grant.durationMonths,
      status: grant.status,
      redeemedAt: grant.purchaseDate ?? grant.redeemedAt,
      revokedAt: grant.revokedAt,
    })),
    existingProExpiration: existingProExpirationIso ? new Date(existingProExpirationIso) : null,
    now,
  });

  const foundingCampaign = {
    eligible: Boolean(campaignState?.foundingCampaignEligible),
    launchRedeemed: timeline.hasLaunchGrant,
    extensionRedeemed: timeline.hasExtensionGrant,
    extensionScheduled: timeline.extensionScheduled,
    campaignAnchorAt: timeline.campaignAnchorAt,
    baseAccessEndsAt: timeline.foundingBaseEndsAt,
    creatorBonusMonths: timeline.creatorBonusMonths,
    finalAccessEndsAt: timeline.promotionalAccessEndsAt,
  };

  if (activePaidSub || isLegacyPaid) {
    return {
      tier: 'paid',
      hasProAccess: true,
      source: 'storekit_subscription',
      accessStartsAt: activePaidSub?.createdAt?.toISOString() ?? entitlementRecord?.createdAt?.toISOString() ?? null,
      accessEndsAt: laterIso(paidExpiration, trialExpiration, timeline.promotionalAccessEndsAt),
      foundingCampaign,
      capabilities: PRO_CAPABILITIES,
    };
  }

  if (activeTrialSub || isLegacyTrial) {
    return {
      tier: 'trial',
      hasProAccess: true,
      source: 'trial',
      accessStartsAt: activeTrialSub?.createdAt?.toISOString() ?? entitlementRecord?.createdAt?.toISOString() ?? null,
      accessEndsAt: laterIso(trialExpiration, timeline.promotionalAccessEndsAt),
      foundingCampaign,
      capabilities: PRO_CAPABILITIES,
    };
  }

  if (timeline.promotionalAccessEndsAt && new Date(timeline.promotionalAccessEndsAt) > now) {
    return {
      tier: 'promotional',
      hasProAccess: true,
      source: timeline.hasLaunchGrant ? 'founding_campaign' : 'creator_campaign',
      accessStartsAt: timeline.promotionalAccessStartsAt,
      accessEndsAt: timeline.promotionalAccessEndsAt,
      foundingCampaign,
      capabilities: PRO_CAPABILITIES,
    };
  }

  return {
    tier: 'free',
    hasProAccess: false,
    source: 'free',
    accessStartsAt: null,
    accessEndsAt: null,
    foundingCampaign,
    capabilities: FREE_CAPABILITIES,
  };
}

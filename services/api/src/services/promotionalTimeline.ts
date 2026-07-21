import { addCalendarMonthsClamped } from '../utils/dateUtils.js';

export interface GrantInput {
  grantType: 'founding_launch' | 'founding_extension' | 'creator_bonus';
  durationMonths: number;
  status: 'active' | 'scheduled' | 'expired' | 'revoked';
  redeemedAt?: Date | string | null;
  revokedAt?: Date | string | null;
}

export interface PromotionalTimelineInput {
  campaignAnchorAt: Date | null;
  grants: GrantInput[];
  maxCreatorBonusMonths?: number;
  existingProExpiration?: Date | null;
  now?: Date;
}

export interface PromotionalTimeline {
  campaignAnchorAt: string | null;
  hasLaunchGrant: boolean;
  hasExtensionGrant: boolean;
  foundingBaseMonths: 0 | 3 | 12;
  creatorBonusMonths: number;
  promotionalAccessStartsAt: string | null;
  foundingBaseEndsAt: string | null;
  promotionalAccessEndsAt: string | null;
  extensionScheduled: boolean;
}

export const DEFAULT_MAX_CREATOR_BONUS_MONTHS = 12;

function maxDate(...dates: Array<Date | null | undefined>): Date | null {
  const valid = dates.filter((date): date is Date => Boolean(date && !Number.isNaN(date.getTime())));
  if (valid.length === 0) return null;
  return new Date(Math.max(...valid.map((date) => date.getTime())));
}

export function calculatePromotionalTimeline(input: PromotionalTimelineInput): PromotionalTimeline {
  const now = input.now ?? new Date();
  const maxCreatorMonths = input.maxCreatorBonusMonths ?? DEFAULT_MAX_CREATOR_BONUS_MONTHS;
  const validGrants = input.grants.filter((grant) => grant.status !== 'revoked' && !grant.revokedAt);

  const hasLaunchGrant = validGrants.some((grant) => grant.grantType === 'founding_launch');
  const hasExtensionGrant = hasLaunchGrant
    && validGrants.some((grant) => grant.grantType === 'founding_extension');
  const foundingBaseMonths: 0 | 3 | 12 = !hasLaunchGrant ? 0 : hasExtensionGrant ? 12 : 3;

  const anchor = hasLaunchGrant && input.campaignAnchorAt
    ? new Date(input.campaignAnchorAt)
    : null;
  const foundingBaseEnd = anchor
    ? addCalendarMonthsClamped(anchor, foundingBaseMonths)
    : null;

  const creatorGrants = validGrants
    .filter((grant) => grant.grantType === 'creator_bonus' && grant.durationMonths === 1)
    .sort((left, right) => {
      const leftDate = left.redeemedAt ? new Date(left.redeemedAt).getTime() : now.getTime();
      const rightDate = right.redeemedAt ? new Date(right.redeemedAt).getTime() : now.getTime();
      return leftDate - rightDate;
    })
    .slice(0, maxCreatorMonths);

  let boundary = maxDate(foundingBaseEnd, input.existingProExpiration ?? null);
  let firstCreatorStart: Date | null = null;

  for (const grant of creatorGrants) {
    const purchaseDate = grant.redeemedAt
      ? new Date(grant.redeemedAt)
      : boundary ?? anchor ?? now;
    if (Number.isNaN(purchaseDate.getTime())) continue;
    const start = maxDate(boundary, purchaseDate) ?? purchaseDate;
    if (!firstCreatorStart) firstCreatorStart = start;
    boundary = addCalendarMonthsClamped(start, 1);
  }

  const creatorBonusMonths = creatorGrants.length;
  const promotionalAccessEndsAtDate = creatorBonusMonths > 0
    ? boundary
    : foundingBaseEnd;
  const promotionalAccessStartsAtDate = anchor ?? firstCreatorStart;

  return {
    campaignAnchorAt: input.campaignAnchorAt?.toISOString() ?? null,
    hasLaunchGrant,
    hasExtensionGrant,
    foundingBaseMonths,
    creatorBonusMonths,
    promotionalAccessStartsAt: promotionalAccessStartsAtDate?.toISOString() ?? null,
    foundingBaseEndsAt: foundingBaseEnd?.toISOString() ?? null,
    promotionalAccessEndsAt: promotionalAccessEndsAtDate?.toISOString() ?? null,
    extensionScheduled: Boolean(
      anchor
      && hasExtensionGrant
      && now < addCalendarMonthsClamped(anchor, 3)
    ),
  };
}

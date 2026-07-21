import { describe, it, expect } from 'vitest';
import { calculatePromotionalTimeline } from './promotionalTimeline.js';

describe('calculatePromotionalTimeline', () => {
  const signupDate = new Date('2026-01-10T10:00:00.000Z');

  it('Launch only: signup Jan 10, launch grant gives Apr 10 end date', () => {
    const timeline = calculatePromotionalTimeline({
      campaignAnchorAt: signupDate,
      grants: [
        { grantType: 'founding_launch', durationMonths: 3, status: 'active' },
      ],
    });

    expect(timeline.hasLaunchGrant).toBe(true);
    expect(timeline.hasExtensionGrant).toBe(false);
    expect(timeline.foundingBaseMonths).toBe(3);
    expect(timeline.creatorBonusMonths).toBe(0);
    expect(timeline.promotionalAccessStartsAt).toBe('2026-01-10T10:00:00.000Z');
    expect(timeline.foundingBaseEndsAt).toBe('2026-04-10T10:00:00.000Z');
    expect(timeline.promotionalAccessEndsAt).toBe('2026-04-10T10:00:00.000Z');
  });

  it('Extension during month 2: signup Jan 10, extension redeemed Mar 1 expands base access to Jan 10 next year', () => {
    const nowMar1 = new Date('2026-03-01T00:00:00.000Z');
    const timeline = calculatePromotionalTimeline({
      campaignAnchorAt: signupDate,
      grants: [
        { grantType: 'founding_launch', durationMonths: 3, status: 'active' },
        { grantType: 'founding_extension', durationMonths: 9, status: 'active' },
      ],
      now: nowMar1,
    });

    expect(timeline.hasLaunchGrant).toBe(true);
    expect(timeline.hasExtensionGrant).toBe(true);
    expect(timeline.foundingBaseMonths).toBe(12);
    expect(timeline.foundingBaseEndsAt).toBe('2027-01-10T10:00:00.000Z');
    expect(timeline.promotionalAccessEndsAt).toBe('2027-01-10T10:00:00.000Z');
    expect(timeline.extensionScheduled).toBe(true); // Before initial 3m end (Apr 10)
  });

  it('Order Independence: Creator before Extension vs Extension before Creator produces identical end date', () => {
    // Sequence A: Creator claimed Feb 1, Extension claimed Mar 1
    const timelineA = calculatePromotionalTimeline({
      campaignAnchorAt: signupDate,
      grants: [
        { grantType: 'founding_launch', durationMonths: 3, status: 'active', redeemedAt: '2026-01-10T10:00:00Z' },
        { grantType: 'creator_bonus', durationMonths: 1, status: 'active', redeemedAt: '2026-02-01T10:00:00Z' },
        { grantType: 'founding_extension', durationMonths: 9, status: 'active', redeemedAt: '2026-03-01T10:00:00Z' },
      ],
    });

    // Sequence B: Extension claimed Mar 1, Creator claimed Feb 1 (opposite order)
    const timelineB = calculatePromotionalTimeline({
      campaignAnchorAt: signupDate,
      grants: [
        { grantType: 'founding_launch', durationMonths: 3, status: 'active', redeemedAt: '2026-01-10T10:00:00Z' },
        { grantType: 'founding_extension', durationMonths: 9, status: 'active', redeemedAt: '2026-03-01T10:00:00Z' },
        { grantType: 'creator_bonus', durationMonths: 1, status: 'active', redeemedAt: '2026-02-01T10:00:00Z' },
      ],
    });

    expect(timelineA.promotionalAccessEndsAt).toBe('2027-02-10T10:00:00.000Z');
    expect(timelineB.promotionalAccessEndsAt).toBe('2027-02-10T10:00:00.000Z');
    expect(timelineA.promotionalAccessEndsAt).toEqual(timelineB.promotionalAccessEndsAt);
  });

  it('Extension without launch should NOT grant extension entitlement', () => {
    const timeline = calculatePromotionalTimeline({
      campaignAnchorAt: signupDate,
      grants: [
        { grantType: 'founding_extension', durationMonths: 9, status: 'active' },
      ],
    });

    expect(timeline.hasLaunchGrant).toBe(false);
    expect(timeline.hasExtensionGrant).toBe(false);
    expect(timeline.foundingBaseMonths).toBe(0);
    expect(timeline.promotionalAccessEndsAt).toBeNull();
  });

  it('Revoked grant should be excluded from timeline calculation', () => {
    const timeline = calculatePromotionalTimeline({
      campaignAnchorAt: signupDate,
      grants: [
        { grantType: 'founding_launch', durationMonths: 3, status: 'active' },
        { grantType: 'founding_extension', durationMonths: 9, status: 'revoked', revokedAt: new Date() },
      ],
    });

    expect(timeline.hasLaunchGrant).toBe(true);
    expect(timeline.hasExtensionGrant).toBe(false);
    expect(timeline.foundingBaseMonths).toBe(3);
    expect(timeline.promotionalAccessEndsAt).toBe('2026-04-10T10:00:00.000Z');
  });

  it('Creator bonus should be capped at maxCreatorBonusMonths', () => {
    const timeline = calculatePromotionalTimeline({
      campaignAnchorAt: signupDate,
      grants: [
        { grantType: 'founding_launch', durationMonths: 3, status: 'active' },
        { grantType: 'creator_bonus', durationMonths: 1, status: 'active' },
        { grantType: 'creator_bonus', durationMonths: 1, status: 'active' },
        { grantType: 'creator_bonus', durationMonths: 1, status: 'active' },
      ],
      maxCreatorBonusMonths: 2,
    });

    expect(timeline.creatorBonusMonths).toBe(2);
    // 3 base months + 2 creator bonus months = 5 months from Jan 10 -> June 10
    expect(timeline.promotionalAccessEndsAt).toBe('2026-06-10T10:00:00.000Z');
  });
});

export type UserPlan = 'free' | 'trial' | 'paid';

export interface BackendEntitlement {
  tier: 'developer' | 'paid' | 'trial' | 'promotional' | 'free';
  hasProAccess: boolean;
  capabilities: Record<string, boolean>;
}

export interface NormalizedEntitlement {
  plan: UserPlan;
  capabilities: Record<string, boolean>;
  limits: {
    maxBoxes: number;
    maxNotesPerBox: number;
    maxReceiptsPerNote: number;
    unfilteredIntensityLocked: boolean;
    unlimitedRegen: boolean;
  };
}

const FREE_CAPABILITIES: Record<string, boolean> = {
  unlimitedBoxes: false,
  unlimitedNotes: false,
  editing: false,
  patterns: false,
  export: false,
  allPerspectiveControls: false,
};

export function normalizeEntitlement(entitlement: BackendEntitlement): NormalizedEntitlement {
  const plan: UserPlan = entitlement.tier === 'trial'
    ? 'trial'
    : entitlement.hasProAccess
      ? 'paid'
      : 'free';
  return {
    plan,
    capabilities: { ...FREE_CAPABILITIES, ...entitlement.capabilities },
    limits: {
      maxBoxes: plan === 'free' ? 5 : Infinity,
      maxNotesPerBox: plan === 'free' ? 5 : Infinity,
      maxReceiptsPerNote: plan === 'free' ? 3 : 10,
      unfilteredIntensityLocked: plan === 'free',
      unlimitedRegen: plan === 'trial',
    },
  };
}

export const FREE_ENTITLEMENT = normalizeEntitlement({
  tier: 'free',
  hasProAccess: false,
  capabilities: FREE_CAPABILITIES,
});

import { describe, expect, it } from 'vitest';
import { normalizeEntitlement } from '@/services/entitlements';

describe('canonical entitlement mapping', () => {
  it('maps backend promotional/developer tiers to paid client access', () => {
    expect(normalizeEntitlement({ tier: 'promotional', hasProAccess: true, capabilities: { editing: true } }).plan).toBe('paid');
    expect(normalizeEntitlement({ tier: 'developer', hasProAccess: true, capabilities: { editing: true } }).plan).toBe('paid');
  });

  it('keeps the handoff free limits at five active Boxes and five Notes per Box', () => {
    const entitlement = normalizeEntitlement({ tier: 'free', hasProAccess: false, capabilities: {} });
    expect(entitlement.limits).toMatchObject({ maxBoxes: 5, maxNotesPerBox: 5 });
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import {
  PROMOTIONAL_PRODUCT_MAP,
  setTestVerificationAdapters,
  validateVerifiedStoreKitClaims,
  verifyStoreKitTransaction,
} from './storekitVerification.js';

const validClaims = {
  transactionId: '10000001',
  originalTransactionId: '10000001',
  productId: 'com.notebox.pro.founding.launch3m',
  bundleId: process.env.APPLE_BUNDLE_ID ?? 'com.notebox.app',
  environment: (process.env.APPLE_STOREKIT_ENVIRONMENT ?? 'Sandbox') as 'Sandbox' | 'Production',
  purchaseDate: Date.now(),
};

describe('StoreKit verified-claim validation', () => {
  afterEach(() => {
    setTestVerificationAdapters(null);
  });

  it('rejects empty signed transactions', async () => {
    await expect(verifyStoreKitTransaction('')).rejects.toThrow('STOREKIT_TRANSACTION_INVALID');
  });

  it('does not decode forged JWS values when no test adapter is installed', async () => {
    await expect(verifyStoreKitTransaction('forged.header.payload')).rejects.toThrow(
      'STOREKIT_TRANSACTION_INVALID',
    );
  });

  it.each([
    ['transactionId', undefined],
    ['productId', undefined],
    ['bundleId', undefined],
    ['purchaseDate', undefined],
  ])('rejects a verified payload missing %s', (field, value) => {
    expect(() => validateVerifiedStoreKitClaims(
      { ...validClaims, [field]: value } as any,
      'hash',
    )).toThrow('STOREKIT_TRANSACTION_INVALID');
  });

  it('rejects an invalid purchase date', () => {
    expect(() => validateVerifiedStoreKitClaims(
      { ...validClaims, purchaseDate: 'not-a-date' } as any,
      'hash',
    )).toThrow('STOREKIT_TRANSACTION_INVALID');
  });

  it('rejects a bundle mismatch', () => {
    expect(() => validateVerifiedStoreKitClaims(
      { ...validClaims, bundleId: 'com.attacker.app' } as any,
      'hash',
    )).toThrow('STOREKIT_TRANSACTION_INVALID');
  });

  it('rejects an environment mismatch', () => {
    const otherEnvironment = validClaims.environment === 'Sandbox' ? 'Production' : 'Sandbox';
    expect(() => validateVerifiedStoreKitClaims(
      { ...validClaims, environment: otherEnvironment } as any,
      'hash',
    )).toThrow('STOREKIT_TRANSACTION_INVALID');
  });

  it('rejects an unrecognized product', () => {
    expect(() => validateVerifiedStoreKitClaims(
      { ...validClaims, productId: 'com.notebox.unrelated.product' } as any,
      'hash',
    )).toThrow('STOREKIT_PRODUCT_NOT_RECOGNIZED');
  });

  it('accepts the configured monthly auto-renewable subscription product', () => {
    const expiresDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
    const result = validateVerifiedStoreKitClaims(
      {
        ...validClaims,
        productId: 'com.notebox.pro.monthly',
        type: 'Auto-Renewable Subscription',
        expiresDate,
      } as any,
      'subscription-hash',
    );

    expect(result.productKind).toBe('subscription');
    expect(result.productId).toBe('com.notebox.pro.monthly');
    expect(result.expiresAt?.getTime()).toBe(expiresDate);
  });

  it('rejects a configured subscription transaction without subscription expiry evidence', () => {
    expect(() => validateVerifiedStoreKitClaims(
      {
        ...validClaims,
        productId: 'com.notebox.pro.monthly',
        type: 'Auto-Renewable Subscription',
      } as any,
      'subscription-hash',
    )).toThrow('STOREKIT_TRANSACTION_INVALID');
  });

  it('normalizes a valid Apple appAccountToken for account binding', () => {
    const result = validateVerifiedStoreKitClaims(
      {
        ...validClaims,
        appAccountToken: '550E8400-E29B-41D4-A716-446655440000',
      } as any,
      'hash',
    );

    expect(result.appAccountToken).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('rejects a malformed Apple appAccountToken instead of weakening account binding', () => {
    expect(() => validateVerifiedStoreKitClaims(
      {
        ...validClaims,
        appAccountToken: 'not-a-uuid',
      } as any,
      'hash',
    )).toThrow('STOREKIT_TRANSACTION_INVALID');
  });

  it('accepts raw verified claims through the test-only adapter', async () => {
    setTestVerificationAdapters({
      verifyTransactionJws: async () => validClaims as any,
    });

    const result = await verifyStoreKitTransaction('test-verified-payload');
    expect(result.productId).toBe(Object.keys(PROMOTIONAL_PRODUCT_MAP)[0]);
    expect(result.transactionId).toBe(validClaims.transactionId);
  });
});

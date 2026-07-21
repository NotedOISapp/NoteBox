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

  it('accepts raw verified claims through the test-only adapter', async () => {
    setTestVerificationAdapters({
      verifyTransactionJws: async () => validClaims as any,
    });

    const result = await verifyStoreKitTransaction('test-verified-payload');
    expect(result.productId).toBe(Object.keys(PROMOTIONAL_PRODUCT_MAP)[0]);
    expect(result.transactionId).toBe(validClaims.transactionId);
  });
});

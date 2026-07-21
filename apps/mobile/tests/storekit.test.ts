import { describe, expect, it, vi } from 'vitest';

import {
  createStoreKitService,
  isStoreKitUserCancellation,
} from '@/services/storekit';
import type { StoreKitAdapter, StoreKitPurchase } from '@/services/storekit';

const PRODUCT_ID = 'com.notebox.pro.monthly';
const APP_ACCOUNT_TOKEN = '00000000-0000-4000-8000-000000000001';
const getAppAccountToken = () => Promise.resolve(APP_ACCOUNT_TOKEN);

function createAdapter(options: {
  purchases?: StoreKitPurchase[];
  purchase?: StoreKitPurchase;
  purchaseError?: { code: string; message: string };
} = {}) {
  const purchase = options.purchase ?? {
    productId: PRODUCT_ID,
    purchaseToken: 'signed-storekit-transaction',
    transactionId: 'transaction-1',
  };
  const calls: string[] = [];
  let purchaseListener: ((nextPurchase: StoreKitPurchase) => void) | undefined;
  let purchaseErrorListener: ((error: { code: string; message: string }) => void) | undefined;
  const adapter: StoreKitAdapter = {
    initConnection: vi.fn(async () => {
      calls.push('connect');
      return true;
    }),
    endConnection: vi.fn(async () => {
      calls.push('disconnect');
    }),
    fetchProducts: vi.fn(async () => {
      calls.push('products');
      return [{ id: PRODUCT_ID, displayPrice: '$7.99' }];
    }),
    requestPurchase: vi.fn(async () => {
      calls.push('purchase');
      if (options.purchaseError) purchaseErrorListener?.(options.purchaseError);
      else purchaseListener?.(purchase);
    }),
    getAvailablePurchases: vi.fn(async () => {
      calls.push('available');
      return options.purchases ?? [];
    }),
    finishTransaction: vi.fn(async () => {
      calls.push('finish');
    }),
    purchaseUpdatedListener: vi.fn((listener) => {
      purchaseListener = listener;
      return { remove: vi.fn() };
    }),
    purchaseErrorListener: vi.fn((listener) => {
      purchaseErrorListener = listener;
      return { remove: vi.fn() };
    }),
  };
  return { adapter, calls };
}

describe('StoreKit purchase and restore', () => {
  it('verifies a subscription with the backend before finishing the transaction', async () => {
    const { adapter, calls } = createAdapter();
    const syncTransactions = vi.fn(async () => {
      calls.push('verify');
      return { entitlement: { hasProAccess: true } };
    });
    const service = createStoreKitService({
      adapter,
      syncTransactions,
      productId: PRODUCT_ID,
      getAppAccountToken,
    });

    const result = await service.purchase();

    expect(adapter.fetchProducts).toHaveBeenCalledWith({ skus: [PRODUCT_ID], type: 'subs' });
    expect(adapter.requestPurchase).toHaveBeenCalledWith({
      request: { ios: { sku: PRODUCT_ID, appAccountToken: APP_ACCOUNT_TOKEN } },
      type: 'subs',
    });
    expect(syncTransactions).toHaveBeenCalledWith(['signed-storekit-transaction']);
    expect(adapter.finishTransaction).toHaveBeenCalledWith({ purchase: result.purchase, isConsumable: false });
    expect(calls.indexOf('verify')).toBeLessThan(calls.indexOf('finish'));
    expect(calls.at(-1)).toBe('disconnect');
  });

  it('does not finish a purchase when the backend does not grant paid access', async () => {
    const { adapter } = createAdapter();
    const service = createStoreKitService({
      adapter,
      productId: PRODUCT_ID,
      getAppAccountToken,
      syncTransactions: vi.fn(async () => ({ entitlement: { hasProAccess: false } })),
    });

    await expect(service.purchase()).rejects.toThrow('backend did not verify');
    expect(adapter.finishTransaction).not.toHaveBeenCalled();
    expect(adapter.endConnection).toHaveBeenCalled();
  });

  it('restores only the configured active subscription and verifies it before finishing', async () => {
    const activePurchase = {
      productId: PRODUCT_ID,
      purchaseToken: 'signed-active-transaction',
      transactionId: 'transaction-active',
    };
    const { adapter, calls } = createAdapter({
      purchases: [
        activePurchase,
        { productId: 'another.product', purchaseToken: 'other-transaction' },
      ],
    });
    const syncTransactions = vi.fn(async () => {
      calls.push('verify');
      return { entitlement: { hasProAccess: true } };
    });
    const tokenLookup = vi.fn(getAppAccountToken);
    const service = createStoreKitService({
      adapter,
      syncTransactions,
      productId: PRODUCT_ID,
      getAppAccountToken: tokenLookup,
    });

    const result = await service.restore();

    expect(adapter.getAvailablePurchases).toHaveBeenCalledWith({ onlyIncludeActiveItemsIOS: true });
    expect(syncTransactions).toHaveBeenCalledWith(['signed-active-transaction']);
    expect(adapter.finishTransaction).toHaveBeenCalledWith({ purchase: activePurchase, isConsumable: false });
    expect(calls.indexOf('verify')).toBeLessThan(calls.indexOf('finish'));
    expect(result.restoredCount).toBe(1);
    expect(tokenLookup).not.toHaveBeenCalled();
  });

  it('does not invent access when there is no matching purchase to restore', async () => {
    const { adapter } = createAdapter({
      purchases: [{ productId: 'another.product', purchaseToken: 'other-transaction' }],
    });
    const syncTransactions = vi.fn();
    const service = createStoreKitService({ adapter, syncTransactions, productId: PRODUCT_ID, getAppAccountToken });

    await expect(service.restore()).resolves.toEqual({ restoredCount: 0 });
    expect(syncTransactions).not.toHaveBeenCalled();
    expect(adapter.finishTransaction).not.toHaveBeenCalled();
  });

  it('refuses to finish a transaction without Apple signed transaction data', async () => {
    const { adapter } = createAdapter({
      purchase: { productId: PRODUCT_ID, transactionId: 'missing-jws' },
    });
    const syncTransactions = vi.fn();
    const service = createStoreKitService({ adapter, syncTransactions, productId: PRODUCT_ID, getAppAccountToken });

    await expect(service.purchase()).rejects.toThrow('signed transaction');
    expect(syncTransactions).not.toHaveBeenCalled();
    expect(adapter.finishTransaction).not.toHaveBeenCalled();
  });

  it('classifies an App Store cancellation without verifying or finishing a transaction', async () => {
    const { adapter } = createAdapter({
      purchaseError: { code: 'user-cancelled', message: 'The user cancelled.' },
    });
    const syncTransactions = vi.fn();
    const service = createStoreKitService({ adapter, syncTransactions, productId: PRODUCT_ID, getAppAccountToken });

    const error = await service.purchase().catch((caught) => caught);

    expect(isStoreKitUserCancellation(error)).toBe(true);
    expect(syncTransactions).not.toHaveBeenCalled();
    expect(adapter.finishTransaction).not.toHaveBeenCalled();
  });

  it('does not start a purchase without a valid backend account-binding token', async () => {
    const { adapter } = createAdapter();
    const syncTransactions = vi.fn();
    const service = createStoreKitService({
      adapter,
      syncTransactions,
      productId: PRODUCT_ID,
      getAppAccountToken: vi.fn(async () => 'not-a-uuid'),
    });

    await expect(service.purchase()).rejects.toThrow('account-binding token');
    expect(adapter.requestPurchase).not.toHaveBeenCalled();
    expect(syncTransactions).not.toHaveBeenCalled();
    expect(adapter.finishTransaction).not.toHaveBeenCalled();
  });
});

import type { RequestPurchaseProps } from 'react-native-iap';

export interface StoreKitPurchase {
  productId: string;
  purchaseToken?: string | null;
  transactionId?: string | null;
}

export interface StoreKitProduct {
  id: string;
  displayPrice?: string;
}

export interface StoreKitPurchaseError {
  code?: string;
  message?: string;
}

export interface StoreKitSubscription {
  remove: () => void;
}

export interface StoreKitAdapter {
  initConnection: () => Promise<boolean>;
  endConnection: () => Promise<void>;
  fetchProducts: (request: { skus: string[]; type: 'subs' }) => Promise<StoreKitProduct[]>;
  requestPurchase: (request: RequestPurchaseProps) => Promise<unknown>;
  getAvailablePurchases: (options: {
    onlyIncludeActiveItemsIOS: boolean;
  }) => Promise<StoreKitPurchase[]>;
  finishTransaction: (request: {
    purchase: StoreKitPurchase;
    isConsumable: false;
  }) => Promise<void>;
  purchaseUpdatedListener: (
    listener: (purchase: StoreKitPurchase) => void,
  ) => StoreKitSubscription;
  purchaseErrorListener: (
    listener: (error: StoreKitPurchaseError) => void,
  ) => StoreKitSubscription;
}

interface EntitlementSyncResult {
  entitlement?: {
    hasProAccess?: boolean;
  };
}

interface StoreKitServiceOptions {
  adapter: StoreKitAdapter;
  productId: string;
  getAppAccountToken: () => Promise<string>;
  syncTransactions: (signedTransactions: string[]) => Promise<EntitlementSyncResult>;
}

export interface StoreKitService {
  purchase: () => Promise<{ purchase: StoreKitPurchase }>;
  restore: () => Promise<{ restoredCount: number }>;
}

export class StoreKitServiceError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'StoreKitServiceError';
  }
}

function requireProductId(productId: string): string {
  const normalized = productId.trim();
  if (!normalized) {
    throw new StoreKitServiceError(
      'The App Store subscription product is not configured.',
      'product-not-configured',
    );
  }
  return normalized;
}

function signedTransactionFor(purchase: StoreKitPurchase): string {
  const signedTransaction = purchase.purchaseToken?.trim();
  if (!signedTransaction) {
    throw new StoreKitServiceError(
      'Apple did not provide signed transaction data for backend verification.',
      'missing-signed-transaction',
    );
  }
  return signedTransaction;
}

function requireAppAccountToken(token: string): string {
  const normalized = token.trim().toLowerCase();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)) {
    throw new StoreKitServiceError(
      'The backend did not provide a valid StoreKit account-binding token.',
      'invalid-app-account-token',
    );
  }
  return normalized;
}

async function verifyAndFinish(
  adapter: StoreKitAdapter,
  syncTransactions: StoreKitServiceOptions['syncTransactions'],
  purchases: StoreKitPurchase[],
): Promise<void> {
  const signedTransactions = [...new Set(purchases.map(signedTransactionFor))];
  const result = await syncTransactions(signedTransactions);
  if (result.entitlement?.hasProAccess !== true) {
    throw new StoreKitServiceError(
      'The backend did not verify paid access. The StoreKit transaction remains unfinished for a safe retry.',
      'backend-verification-failed',
    );
  }

  for (const purchase of purchases) {
    await adapter.finishTransaction({ purchase, isConsumable: false });
  }
}

export function createStoreKitService({
  adapter,
  productId: configuredProductId,
  getAppAccountToken,
  syncTransactions,
}: StoreKitServiceOptions): StoreKitService {
  const productId = requireProductId(configuredProductId);

  return {
    async purchase() {
      const appAccountToken = requireAppAccountToken(await getAppAccountToken());
      await adapter.initConnection();
      let purchaseUpdate: StoreKitSubscription | undefined;
      let purchaseError: StoreKitSubscription | undefined;

      try {
        const products = await adapter.fetchProducts({ skus: [productId], type: 'subs' });
        if (!products.some((product) => product.id === productId)) {
          throw new StoreKitServiceError(
            'The NoteBox subscription is not available from the App Store.',
            'product-unavailable',
          );
        }

        return await new Promise<{ purchase: StoreKitPurchase }>((resolve, reject) => {
          let settled = false;
          const settle = (callback: () => void) => {
            if (settled) return;
            settled = true;
            callback();
          };

          purchaseUpdate = adapter.purchaseUpdatedListener((purchase) => {
            if (purchase.productId !== productId) return;
            void verifyAndFinish(adapter, syncTransactions, [purchase])
              .then(() => settle(() => resolve({ purchase })))
              .catch((error) => settle(() => reject(error)));
          });
          purchaseError = adapter.purchaseErrorListener((error) => {
            const code = error.code ?? 'purchase-failed';
            settle(() => reject(new StoreKitServiceError(
              error.message ?? 'The App Store purchase could not be completed.',
              code,
            )));
          });

          void adapter.requestPurchase({
            request: { ios: { sku: productId, appAccountToken } },
            type: 'subs',
          }).catch((error: unknown) => {
            settle(() => reject(error));
          });
        });
      } finally {
        purchaseUpdate?.remove();
        purchaseError?.remove();
        await adapter.endConnection();
      }
    },

    async restore() {
      await adapter.initConnection();
      try {
        const purchases = await adapter.getAvailablePurchases({
          onlyIncludeActiveItemsIOS: true,
        });
        const matchingPurchases = purchases.filter((purchase) => purchase.productId === productId);
        if (matchingPurchases.length === 0) return { restoredCount: 0 };

        await verifyAndFinish(adapter, syncTransactions, matchingPurchases);
        return { restoredCount: matchingPurchases.length };
      } finally {
        await adapter.endConnection();
      }
    },
  };
}

export function configuredStoreKitProductId(
  configured = process.env.EXPO_PUBLIC_IOS_SUBSCRIPTION_PRODUCT_ID,
): string {
  return requireProductId(configured ?? '');
}

async function createNativeAdapter(): Promise<StoreKitAdapter> {
  const native = await import('react-native-iap');
  return {
    initConnection: native.initConnection,
    endConnection: async () => {
      await native.endConnection();
    },
    fetchProducts: (request) => native.fetchProducts(request) as Promise<StoreKitProduct[]>,
    requestPurchase: native.requestPurchase,
    getAvailablePurchases: (options) =>
      native.getAvailablePurchases(options) as Promise<StoreKitPurchase[]>,
    finishTransaction: (request) => native.finishTransaction(request as never),
    purchaseUpdatedListener: (listener) => native.purchaseUpdatedListener(listener as never),
    purchaseErrorListener: (listener) => native.purchaseErrorListener(listener as never),
  };
}

async function nativeService(): Promise<StoreKitService> {
  const { api } = await import('@/services/api');
  return createStoreKitService({
    adapter: await createNativeAdapter(),
    productId: configuredStoreKitProductId(),
    getAppAccountToken: async () => (await api.storekit.getPurchaseContext()).appAccountToken,
    syncTransactions: api.storekit.sync,
  });
}

export async function purchaseNoteBoxSubscription() {
  return (await nativeService()).purchase();
}

export async function restoreNoteBoxSubscription() {
  return (await nativeService()).restore();
}

export function isStoreKitUserCancellation(error: unknown): boolean {
  return error instanceof StoreKitServiceError
    && ['user-cancelled', 'user-canceled'].includes(error.code.toLowerCase());
}

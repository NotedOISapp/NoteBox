import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  SignedDataVerifier,
  Environment,
  ResponseBodyV2DecodedPayload,
  JWSTransactionDecodedPayload,
} from '@apple/app-store-server-library';
import {
  APPLE_BUNDLE_ID,
  APPLE_APP_ID_NUMBER,
  APPLE_STOREKIT_ENVIRONMENT,
  APPLE_SUBSCRIPTION_PRODUCT_IDS,
  APPLE_ROOT_CERTIFICATES_PATH,
  APPLE_STOREKIT_ENABLE_ONLINE_CHECKS,
  isProd,
} from '../config/env.js';

export const PROMOTIONAL_PRODUCT_MAP = {
  'com.notebox.pro.founding.launch3m': {
    campaignId: 'founding_launch_2026',
    campaignType: 'founding_launch',
    grantType: 'founding_launch',
    durationMonths: 3,
  },
  'com.notebox.pro.founding.extension9m': {
    campaignId: 'founding_extension_2026',
    campaignType: 'founding_extension',
    grantType: 'founding_extension',
    durationMonths: 9,
    requiredLaunchCampaignId: 'founding_launch_2026',
  },
  'com.notebox.pro.creator.bonus1m': {
    campaignId: 'creator_bonus_2026',
    campaignType: 'creator_bonus',
    grantType: 'creator_bonus',
    durationMonths: 1,
  },
} as const;

export type PromotionalProductId = keyof typeof PROMOTIONAL_PRODUCT_MAP;
export type PromotionalGrantType = 'founding_launch' | 'founding_extension' | 'creator_bonus';
export type StoreKitProductKind = 'promotional' | 'subscription';

export function isPromotionalProductId(productId: string): productId is PromotionalProductId {
  return productId in PROMOTIONAL_PRODUCT_MAP;
}

export interface VerifiedStoreKitTransaction {
  transactionId: string;
  originalTransactionId: string | null;
  productId: string;
  productKind: StoreKitProductKind;
  appAccountToken: string | null;
  purchaseDate: Date;
  originalPurchaseDate: Date | null;
  expiresAt: Date | null;
  offerDiscountType: string | null;
  environment: 'Sandbox' | 'Production';
  revokedAt: Date | null;
  revocationReason: string | null;
  signedTransactionHash: string;
}

export interface VerifiedAppStoreNotification {
  decodedNotification: ResponseBodyV2DecodedPayload;
  verifiedTransaction: VerifiedStoreKitTransaction | null;
}

export interface TestVerificationAdapters {
  verifyTransactionJws?: (signedTransaction: string) => Promise<JWSTransactionDecodedPayload>;
  verifyNotificationJws?: (signedNotification: string) => Promise<{
    decodedNotification: ResponseBodyV2DecodedPayload;
    decodedTransaction?: JWSTransactionDecodedPayload | null;
  }>;
}

let testAdapters: TestVerificationAdapters | null = null;

export function setTestVerificationAdapters(adapters: TestVerificationAdapters | null): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Test verification adapters can only be installed in test environment');
  }
  testAdapters = adapters;
}

export function loadAppleRootCertificates(): Buffer[] {
  if (!APPLE_ROOT_CERTIFICATES_PATH || !fs.existsSync(APPLE_ROOT_CERTIFICATES_PATH)) {
    return [];
  }

  const stats = fs.statSync(APPLE_ROOT_CERTIFICATES_PATH);
  if (stats.isFile()) {
    return [fs.readFileSync(APPLE_ROOT_CERTIFICATES_PATH)];
  }
  if (!stats.isDirectory()) {
    return [];
  }

  return fs
    .readdirSync(APPLE_ROOT_CERTIFICATES_PATH)
    .filter((file) => /\.(cer|pem|crt|der)$/i.test(file))
    .map((file) => fs.readFileSync(path.join(APPLE_ROOT_CERTIFICATES_PATH, file)));
}

let storeKitVerifierInstance: SignedDataVerifier | null = null;

export function getStoreKitVerifier(): SignedDataVerifier {
  if (storeKitVerifierInstance) {
    return storeKitVerifierInstance;
  }

  const rootCerts = loadAppleRootCertificates();
  if (isProd && rootCerts.length === 0) {
    throw new Error('Critical Startup Error: zero valid Apple root certificates loaded');
  }
  if (!APPLE_BUNDLE_ID) {
    throw new Error('Critical Startup Error: APPLE_BUNDLE_ID is required');
  }

  const environment = APPLE_STOREKIT_ENVIRONMENT === 'Production'
    ? Environment.PRODUCTION
    : Environment.SANDBOX;

  storeKitVerifierInstance = new SignedDataVerifier(
    rootCerts,
    APPLE_STOREKIT_ENABLE_ONLINE_CHECKS,
    environment,
    APPLE_BUNDLE_ID,
    APPLE_APP_ID_NUMBER,
  );
  return storeKitVerifierInstance;
}

function parseRequiredDate(value: unknown): Date {
  if (value === undefined || value === null) {
    throw new Error('STOREKIT_TRANSACTION_INVALID');
  }
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) {
    throw new Error('STOREKIT_TRANSACTION_INVALID');
  }
  return date;
}

export function validateVerifiedStoreKitClaims(
  decoded: JWSTransactionDecodedPayload,
  signedTransactionHash: string,
): VerifiedStoreKitTransaction {
  if (!decoded || typeof decoded !== 'object') {
    throw new Error('STOREKIT_TRANSACTION_INVALID');
  }

  const transactionId = decoded.transactionId ? String(decoded.transactionId).trim() : '';
  const productIdRaw = decoded.productId ? String(decoded.productId).trim() : '';
  const bundleId = decoded.bundleId ? String(decoded.bundleId).trim() : '';
  const environment = decoded.environment;

  if (!transactionId || !productIdRaw || !bundleId) {
    throw new Error('STOREKIT_TRANSACTION_INVALID');
  }
  if (bundleId !== APPLE_BUNDLE_ID) {
    throw new Error('STOREKIT_TRANSACTION_INVALID');
  }
  if (environment !== 'Sandbox' && environment !== 'Production') {
    throw new Error('STOREKIT_TRANSACTION_INVALID');
  }
  if (environment !== APPLE_STOREKIT_ENVIRONMENT) {
    throw new Error('STOREKIT_TRANSACTION_INVALID');
  }
  const isPromotionalProduct = isPromotionalProductId(productIdRaw);
  const isSubscriptionProduct = APPLE_SUBSCRIPTION_PRODUCT_IDS.includes(productIdRaw);
  if (!isPromotionalProduct && !isSubscriptionProduct) {
    throw new Error('STOREKIT_PRODUCT_NOT_RECOGNIZED');
  }

  let expiresAt: Date | null = null;
  if (isSubscriptionProduct) {
    if (
      decoded.type !== 'Auto-Renewable Subscription'
      || !decoded.originalTransactionId
      || decoded.expiresDate == null
    ) {
      throw new Error('STOREKIT_TRANSACTION_INVALID');
    }
    expiresAt = parseRequiredDate(decoded.expiresDate);
  }

  const purchaseDate = parseRequiredDate(decoded.purchaseDate);
  const originalPurchaseDate = decoded.originalPurchaseDate == null
    ? null
    : parseRequiredDate(decoded.originalPurchaseDate);
  const revokedAt = decoded.revocationDate == null
    ? null
    : parseRequiredDate(decoded.revocationDate);
  const appAccountToken = decoded.appAccountToken
    ? String(decoded.appAccountToken).toLowerCase()
    : null;
  if (
    appAccountToken
    && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(appAccountToken)
  ) {
    throw new Error('STOREKIT_TRANSACTION_INVALID');
  }

  return {
    transactionId,
    originalTransactionId: decoded.originalTransactionId
      ? String(decoded.originalTransactionId)
      : null,
    productId: productIdRaw,
    productKind: isPromotionalProduct ? 'promotional' : 'subscription',
    appAccountToken,
    purchaseDate,
    originalPurchaseDate,
    expiresAt,
    offerDiscountType: decoded.offerDiscountType == null
      ? null
      : String(decoded.offerDiscountType),
    environment,
    revokedAt,
    revocationReason: decoded.revocationReason == null
      ? null
      : String(decoded.revocationReason),
    signedTransactionHash,
  };
}

export async function verifyStoreKitTransaction(
  signedTransaction: string,
): Promise<VerifiedStoreKitTransaction> {
  if (!signedTransaction || typeof signedTransaction !== 'string') {
    throw new Error('STOREKIT_TRANSACTION_INVALID');
  }

  const hash = crypto.createHash('sha256').update(signedTransaction).digest('hex');
  let decoded: JWSTransactionDecodedPayload;

  try {
    if (testAdapters?.verifyTransactionJws) {
      decoded = await testAdapters.verifyTransactionJws(signedTransaction);
    } else {
      decoded = await getStoreKitVerifier().verifyAndDecodeTransaction(signedTransaction);
    }
  } catch {
    throw new Error('STOREKIT_TRANSACTION_INVALID');
  }

  return validateVerifiedStoreKitClaims(decoded, hash);
}

export async function verifyAppStoreNotification(
  signedNotification: string,
): Promise<VerifiedAppStoreNotification> {
  if (!signedNotification || typeof signedNotification !== 'string') {
    throw new Error('STOREKIT_NOTIFICATION_INVALID');
  }

  let decodedNotification: ResponseBodyV2DecodedPayload;
  let decodedTransaction: JWSTransactionDecodedPayload | null = null;

  try {
    if (testAdapters?.verifyNotificationJws) {
      const testResult = await testAdapters.verifyNotificationJws(signedNotification);
      decodedNotification = testResult.decodedNotification;
      decodedTransaction = testResult.decodedTransaction ?? null;
    } else {
      const verifier = getStoreKitVerifier();
      decodedNotification = await verifier.verifyAndDecodeNotification(signedNotification);
      if (decodedNotification.data?.signedTransactionInfo) {
        decodedTransaction = await verifier.verifyAndDecodeTransaction(
          decodedNotification.data.signedTransactionInfo,
        );
      }
    }
  } catch {
    throw new Error('STOREKIT_NOTIFICATION_INVALID');
  }

  if (!decodedNotification.notificationUUID || !decodedNotification.notificationType) {
    throw new Error('STOREKIT_NOTIFICATION_INVALID');
  }
  const notificationEnvironment = decodedNotification.data?.environment;
  if (
    notificationEnvironment !== undefined
    && notificationEnvironment !== APPLE_STOREKIT_ENVIRONMENT
  ) {
    throw new Error('STOREKIT_NOTIFICATION_INVALID');
  }

  const actionable = decodedNotification.notificationType === 'REVOKE'
    || decodedNotification.notificationType === 'REFUND'
    || decodedNotification.subtype === 'REFUND';

  if (actionable && !decodedTransaction) {
    throw new Error('STOREKIT_NOTIFICATION_TRANSACTION_REQUIRED');
  }

  const verifiedTransaction = decodedTransaction
    ? validateVerifiedStoreKitClaims(
        decodedTransaction,
        crypto.createHash('sha256')
          .update(decodedNotification.data?.signedTransactionInfo ?? JSON.stringify(decodedTransaction))
          .digest('hex'),
      )
    : null;

  return { decodedNotification, verifiedTransaction };
}

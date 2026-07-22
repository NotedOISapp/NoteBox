import dotenv from 'dotenv';
dotenv.config();

/**
 * Gets an environment variable or throws an error if it is not set or empty.
 */
export function mustGetEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value.trim() === '') {
    if (process.env.NODE_ENV === 'test') {
      if (key === 'DATABASE_URL') return 'postgresql://notebox:password@localhost:5432/notebox_test';
      if (key === 'JWT_ACCESS_SECRET') return 'test-access-secret-at-least-32-chars';
      if (key === 'JWT_REFRESH_SECRET') return 'test-refresh-secret-at-least-32-chars';
      if (key === 'FIELD_ENCRYPTION_KEY') return '0000000000000000000000000000000000000000000000000000000000000000';
      if (key === 'CORS_ORIGIN') return '*';
      if (key === 'RATE_LIMIT_WINDOW_MS') return '900000';
      if (key === 'RATE_LIMIT_MAX_REQUESTS') return '100';
    }
    throw new Error(`Critical Config Error: Environment variable "${key}" is required but not set.`);
  }
  return value.trim();
}

export const NODE_ENV = process.env.NODE_ENV || 'development';
export const isProd = NODE_ENV === 'production';

export function parsePositiveSafeInteger(value: string, key: string): number {
  if (!/^\d+$/.test(value)) {
    throw new Error(`Critical Config Error: ${key} must be a positive integer string.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Critical Config Error: ${key} must be a positive safe integer.`);
  }
  return parsed;
}

// Port setting (usually not a secret, but let's enforce or fallback to 3001)
export const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Retrieve all critical variables using the mustGetEnv helper
export const DATABASE_URL = mustGetEnv('DATABASE_URL');
export const JWT_ACCESS_SECRET = mustGetEnv('JWT_ACCESS_SECRET');
export const JWT_REFRESH_SECRET = mustGetEnv('JWT_REFRESH_SECRET');
export const FIELD_ENCRYPTION_KEY = mustGetEnv('FIELD_ENCRYPTION_KEY');
export const CORS_ORIGIN = mustGetEnv('CORS_ORIGIN');
export const ADMIN_API_KEY = process.env.ADMIN_API_KEY || (isProd ? '' : 'test-admin-secret-key-32-chars-long');

// Rate limiting configurations
export const RATE_LIMIT_WINDOW_MS = parseInt(mustGetEnv('RATE_LIMIT_WINDOW_MS'), 10);
export const RATE_LIMIT_MAX_REQUESTS = parseInt(mustGetEnv('RATE_LIMIT_MAX_REQUESTS'), 10);

export const EXPORT_STORAGE_PROVIDER = process.env.EXPORT_STORAGE_PROVIDER || (isProd ? 's3' : 'memory');
export const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || '';
export const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Receipt security scanning and OCR are server-only provider integrations.
// Development/test may leave them disabled; production must configure both.
export const RECEIPT_SCAN_PROVIDER_URL = (process.env.RECEIPT_SCAN_PROVIDER_URL || '').trim();
export const RECEIPT_SCAN_PROVIDER_TOKEN = (process.env.RECEIPT_SCAN_PROVIDER_TOKEN || '').trim();
export const RECEIPT_OCR_PROVIDER_URL = (process.env.RECEIPT_OCR_PROVIDER_URL || '').trim();
export const RECEIPT_OCR_PROVIDER_TOKEN = (process.env.RECEIPT_OCR_PROVIDER_TOKEN || '').trim();
export const RECEIPT_PROCESSING_TIMEOUT_MS = parsePositiveSafeInteger(
  process.env.RECEIPT_PROCESSING_TIMEOUT_MS || '15000',
  'RECEIPT_PROCESSING_TIMEOUT_MS',
);
export const RECEIPT_PROCESSING_MAX_BYTES = parsePositiveSafeInteger(
  process.env.RECEIPT_PROCESSING_MAX_BYTES || String(10 * 1024 * 1024),
  'RECEIPT_PROCESSING_MAX_BYTES',
);

function validatePrivateProviderEndpoint(urlValue: string, token: string, label: string, required: boolean): void {
  if (!urlValue && !token && !required) return;
  if (!urlValue || !token) {
    throw new Error(`Critical Config Error: ${label} URL and token must be configured together.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(urlValue);
  } catch {
    throw new Error(`Critical Config Error: ${label} URL is invalid.`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) {
    throw new Error(`Critical Config Error: ${label} URL must be credential-free HTTPS without a fragment.`);
  }
  if (token.length < 32) {
    throw new Error(`Critical Config Error: ${label} token must be at least 32 characters.`);
  }
}

validatePrivateProviderEndpoint(RECEIPT_SCAN_PROVIDER_URL, RECEIPT_SCAN_PROVIDER_TOKEN, 'RECEIPT_SCAN_PROVIDER', isProd);
validatePrivateProviderEndpoint(RECEIPT_OCR_PROVIDER_URL, RECEIPT_OCR_PROVIDER_TOKEN, 'RECEIPT_OCR_PROVIDER', isProd);
if (RECEIPT_PROCESSING_TIMEOUT_MS < 1000 || RECEIPT_PROCESSING_TIMEOUT_MS > 60000) {
  throw new Error('Critical Config Error: RECEIPT_PROCESSING_TIMEOUT_MS must be between 1000 and 60000.');
}
if (RECEIPT_PROCESSING_MAX_BYTES > 50 * 1024 * 1024) {
  throw new Error('Critical Config Error: RECEIPT_PROCESSING_MAX_BYTES cannot exceed 50 MiB.');
}

// StoreKit 2 & Apple Configuration
export const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || (isProd ? '' : 'com.notebox.app');
export const APPLE_APP_ID = process.env.APPLE_APP_ID || (isProd ? '' : '1234567890');
export const APPLE_APP_ID_NUMBER = parsePositiveSafeInteger(APPLE_APP_ID, 'APPLE_APP_ID');
const storeKitEnvironmentValue = process.env.APPLE_STOREKIT_ENVIRONMENT || (isProd ? 'Production' : 'Sandbox');
if (storeKitEnvironmentValue !== 'Sandbox' && storeKitEnvironmentValue !== 'Production') {
  throw new Error('Critical Config Error: APPLE_STOREKIT_ENVIRONMENT must be Sandbox or Production.');
}
export const APPLE_STOREKIT_ENVIRONMENT: 'Sandbox' | 'Production' = storeKitEnvironmentValue;
const subscriptionProductIdsValue = process.env.APPLE_SUBSCRIPTION_PRODUCT_IDS
  || (isProd ? '' : 'com.notebox.pro.monthly');
export const APPLE_SUBSCRIPTION_PRODUCT_IDS = [...new Set(
  subscriptionProductIdsValue
    .split(',')
    .map((productId) => productId.trim())
    .filter(Boolean),
)];
if (APPLE_SUBSCRIPTION_PRODUCT_IDS.some((productId) => !/^[A-Za-z0-9][A-Za-z0-9._-]{1,254}$/.test(productId))) {
  throw new Error('Critical Config Error: APPLE_SUBSCRIPTION_PRODUCT_IDS contains an invalid App Store product ID.');
}
export const APPLE_ROOT_CERTIFICATES_PATH = process.env.APPLE_ROOT_CERTIFICATES_PATH || '';
export const APPLE_STOREKIT_ENABLE_ONLINE_CHECKS = process.env.APPLE_STOREKIT_ENABLE_ONLINE_CHECKS === 'true';
export const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || (isProd ? '' : 'com.notebox.app');
export const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID || '';
export const APPLE_KEY_ID = process.env.APPLE_KEY_ID || '';
export const APPLE_PRIVATE_KEY_PATH = process.env.APPLE_PRIVATE_KEY_PATH || '';

// SEC-003: Production Config Guardrails
if (isProd) {
  // 1. JWT Access Secret Check
  if (JWT_ACCESS_SECRET === 'change-me-access-secret-at-least-32-chars') {
    throw new Error('Production Guardrail Violation: JWT_ACCESS_SECRET cannot use the default development placeholder.');
  }
  if (JWT_ACCESS_SECRET.length < 32) {
    throw new Error('Production Guardrail Violation: JWT_ACCESS_SECRET must be at least 32 characters long.');
  }

  // 2. JWT Refresh Secret Check
  if (JWT_REFRESH_SECRET === 'change-me-refresh-secret-at-least-32-chars') {
    throw new Error('Production Guardrail Violation: JWT_REFRESH_SECRET cannot use the default development placeholder.');
  }
  if (JWT_REFRESH_SECRET.length < 32) {
    throw new Error('Production Guardrail Violation: JWT_REFRESH_SECRET must be at least 32 characters long.');
  }

  // 3. Field Encryption Key Check
  if (FIELD_ENCRYPTION_KEY === '0000000000000000000000000000000000000000000000000000000000000000') {
    throw new Error('Production Guardrail Violation: FIELD_ENCRYPTION_KEY cannot use the default development placeholder.');
  }
  if (FIELD_ENCRYPTION_KEY.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(FIELD_ENCRYPTION_KEY)) {
    throw new Error('Production Guardrail Violation: FIELD_ENCRYPTION_KEY must be a valid 64-character hex string (representing 32 bytes).');
  }

  // 4. CORS Origin Check
  if (CORS_ORIGIN === '*') {
    throw new Error('Production Guardrail Violation: CORS_ORIGIN cannot be wildcard "*" in production mode to prevent unauthorized cross-origin access.');
  }

  // 5. Storage Provider Check
  if (EXPORT_STORAGE_PROVIDER !== 's3') {
    throw new Error('Production Guardrail Violation: EXPORT_STORAGE_PROVIDER must be "s3" in production.');
  }
  if (!S3_BUCKET_NAME) {
    throw new Error('Production Guardrail Violation: S3_BUCKET_NAME must be set in production.');
  }

  // 6. StoreKit Guardrails
  if (!APPLE_BUNDLE_ID || APPLE_BUNDLE_ID === 'change-me') {
    throw new Error('Production Guardrail Violation: APPLE_BUNDLE_ID must be set in production.');
  }
  if (!Number.isSafeInteger(APPLE_APP_ID_NUMBER) || APPLE_APP_ID_NUMBER <= 0) {
    throw new Error('Production Guardrail Violation: APPLE_APP_ID must be a positive safe integer in production.');
  }
  if (APPLE_STOREKIT_ENVIRONMENT !== 'Production') {
    throw new Error('Production Guardrail Violation: APPLE_STOREKIT_ENVIRONMENT must be "Production" in production mode.');
  }
  if (APPLE_SUBSCRIPTION_PRODUCT_IDS.length === 0) {
    throw new Error('Production Guardrail Violation: APPLE_SUBSCRIPTION_PRODUCT_IDS must contain at least one configured subscription product ID.');
  }
  if (!APPLE_ROOT_CERTIFICATES_PATH) {
    throw new Error('Production Guardrail Violation: APPLE_ROOT_CERTIFICATES_PATH must be set in production.');
  }
  if (!APPLE_CLIENT_ID || !APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY_PATH) {
    throw new Error('Production Guardrail Violation: Apple OAuth client, team, key ID, and private-key path are required.');
  }
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Production Guardrail Violation: OPENAI_API_KEY is required for AI Perspectives.');
  }
}

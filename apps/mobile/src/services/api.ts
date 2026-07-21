import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

export interface AppleCredentialPayload {
  identityToken: string;
  appleId?: string;
  authorizationCode?: string | null;
  email?: string | null;
  displayName?: string | null;
}

export interface SearchMatch {
  resultType?: 'note' | 'box';
  noteId: string | null;
  boxId: string;
  boxName: string;
  matchType: 'note_body' | 'add_more' | 'ocr_text' | 'box_title';
  snippet: string;
  createdAt: string;
}

export interface SearchResponse {
  success: true;
  query: string;
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  results: SearchMatch[];
}

export interface PatternMatch {
  noteId: string;
  date: string;
  quote: string;
}

export interface PatternInsight {
  key: string;
  name: string;
  description: string;
  matches: PatternMatch[];
}

export interface ExportStatusResponse {
  success: true;
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'expired';
  expiresAt?: string;
  generatedAt?: string;
  downloadUrl?: string;
  failureCode?: string;
}

export interface DeletionStatusResponse {
  success: true;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  queuedAt?: string;
  completedAt?: string;
}

export interface ReceiptRecord {
  id: string;
  noteId: string;
  contentType: string;
  sizeBytes: string;
  scanStatus: 'pending' | 'clean' | 'rejected' | 'unavailable';
  createdAt: string;
}

export type ReceiptOcrResponse =
  | { receiptId: string; status: 'processing'; stage: 'security_scan' | 'text_extraction'; retryAfterSeconds: number }
  | { receiptId: string; status: 'blocked'; reason: string }
  | { receiptId: string; status: 'unavailable'; reason: string }
  | { receiptId: string; status: 'ready'; text: string; extractedAt: string };

export interface ReceiptUploadAsset {
  uri: string;
  contentType: string;
}

export interface ReceiptUploadAuthorization {
  reservationId: string;
  uploadUrl: string;
  method: string;
  headers?: Record<string, string>;
  expiresAt: string;
}

export interface ReceiptUploadOptions {
  authorization?: ReceiptUploadAuthorization;
  onAuthorization?: (authorization: ReceiptUploadAuthorization) => Promise<void>;
}

export function resolveApiBaseUrl(configuredUrl?: string, hostUri?: string, isDevelopment = false): string {
  const configured = configuredUrl?.trim().replace(/\/$/, '');
  if (configured) return configured;
  if (isDevelopment) {
    const host = hostUri?.split(':')[0] || 'localhost';
    return `http://${host}:3001`;
  }
  throw new Error('EXPO_PUBLIC_API_URL must be configured for production builds.');
}

const getApiBaseUrl = () => resolveApiBaseUrl(
  process.env.EXPO_PUBLIC_API_URL,
  Constants.expoConfig?.hostUri,
  typeof __DEV__ !== 'undefined' && __DEV__,
);

/**
 * Retrieves the stored access token
 */
async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('access_token');
  } catch {
    return null;
  }
}

/**
 * Retrieves the stored refresh token
 */
async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('refresh_token');
  } catch {
    return null;
  }
}

/**
 * Updates the stored token credentials
 */
async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync('access_token', accessToken);
  await SecureStore.setItemAsync('refresh_token', refreshToken);
}

/**
 * Wipes credentials on logout or account deletion
 */
export async function clearTokens(): Promise<void> {
  const results = await Promise.allSettled([
    SecureStore.deleteItemAsync('access_token'),
    SecureStore.deleteItemAsync('refresh_token'),
  ]);
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('Secure credentials could not be fully removed from this device.');
  }
}

/**
 * Performs token rotation via /v1/auth/refresh
 */
async function rotateRefreshToken(): Promise<boolean> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${getApiBaseUrl()}/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      await saveTokens(data.accessToken, data.refreshToken);
      return true;
    }
  } catch (error) {
    console.error('Token rotation failed:', error);
  }

  // Clear tokens if rotation fails (session expired)
  await clearTokens();
  return false;
}

/**
 * Central HTTP fetch client with authorization and automatic token rotation
 */
async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<any> {
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const config = {
    ...options,
    headers,
  };

  let response = await fetch(`${getApiBaseUrl()}${endpoint}`, config);

  // If unauthorized (expired token), attempt rotation once
  if (response.status === 401 && accessToken) {
    console.log('Access token expired, rotating token...');
    const rotated = await rotateRefreshToken();
    if (rotated) {
      // Retry with new access token
      const nextToken = await getAccessToken();
      headers['Authorization'] = `Bearer ${nextToken}`;
      response = await fetch(`${getApiBaseUrl()}${endpoint}`, config);
    }
  }

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw {
      status: response.status,
      error: errData.error || 'ApiError',
      message: errData.message || 'API request failed',
    };
  }

  return response.json();
}

async function downloadAuthenticatedExport(endpoint: string): Promise<Uint8Array> {
  if (!/^\/v1\/privacy\/export-request\/[^/?#]+\/download$/.test(endpoint)) {
    throw new Error('The export download location is invalid.');
  }
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = {
    Accept: 'application/zip',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
  let response = await fetch(`${getApiBaseUrl()}${endpoint}`, { headers });
  if (response.status === 401 && accessToken && await rotateRefreshToken()) {
    const nextToken = await getAccessToken();
    headers.Authorization = `Bearer ${nextToken}`;
    response = await fetch(`${getApiBaseUrl()}${endpoint}`, { headers });
  }
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw {
      status: response.status,
      error: errData.error || 'ApiError',
      message: errData.message || 'Export download failed',
    };
  }
  return new Uint8Array(await response.arrayBuffer());
}

function apiErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'error' in error
    ? String((error as { error?: unknown }).error ?? '')
    : undefined;
}

async function confirmReceiptUpload(reservationId: string): Promise<ReceiptRecord> {
  const confirmation = await apiFetch('/v1/receipts/confirm', {
    method: 'POST',
    body: JSON.stringify({ reservationId }),
  }) as { receipt: ReceiptRecord };
  return confirmation.receipt;
}

async function uploadReceiptAsset(
  noteId: string,
  asset: ReceiptUploadAsset,
  options: ReceiptUploadOptions = {},
): Promise<ReceiptRecord> {
  let authorization = options.authorization;

  if (authorization) {
    try {
      // Confirm first: a prior PUT/confirm may have completed before the queue
      // checkpoint was removed. Confirmation is idempotent for the reservation.
      return await confirmReceiptUpload(authorization.reservationId);
    } catch (error) {
      const code = apiErrorCode(error);
      const expired = new Date(authorization.expiresAt).getTime() <= Date.now();
      if (code === 'STORAGE_OBJECT_NOT_FOUND') {
        // Authorization is still usable only while its signed upload URL is live.
        if (expired) authorization = undefined;
      } else if (['RESERVATION_INVALID', 'RESERVATION_EXPIRED', 'RESERVATION_CONSUMED'].includes(code ?? '')) {
        authorization = undefined;
      } else {
        throw error;
      }
    }
  }

  const fileResponse = await fetch(asset.uri);
  const body = await fileResponse.blob();
  if (body.size <= 0) throw new Error('The selected file is empty.');

  if (!authorization) {
    authorization = await apiFetch('/v1/receipts/upload-url', {
      method: 'POST',
      body: JSON.stringify({ noteId, contentType: asset.contentType, sizeBytes: body.size }),
    }) as ReceiptUploadAuthorization;
    await options.onAuthorization?.(authorization);
  }

  const isExternalUrl = /^https?:\/\//i.test(authorization.uploadUrl);
  const uploadUrl = isExternalUrl ? authorization.uploadUrl : `${getApiBaseUrl()}${authorization.uploadUrl}`;
  const headers: Record<string, string> = {
    ...(authorization.headers || {}),
    'Content-Type': asset.contentType,
  };
  if (!isExternalUrl) {
    const accessToken = await getAccessToken();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: authorization.method || 'PUT',
    headers,
    body,
  });
  if (!uploadResponse.ok) {
    const errorBody = await uploadResponse.json().catch(() => ({}));
    throw {
      status: uploadResponse.status,
      error: errorBody.error || 'RECEIPT_UPLOAD_FAILED',
      message: errorBody.message || 'Receipt upload failed.',
    };
  }

  return confirmReceiptUpload(authorization.reservationId);
}

// ── API Operations ──────────────────────────────────────────────────────────
export const api = {
  auth: {
    appleSignIn: (credential: AppleCredentialPayload) =>
      apiFetch('/v1/auth/apple', {
        method: 'POST',
        body: JSON.stringify(credential),
      }).then(async (data) => {
        await saveTokens(data.accessToken, data.refreshToken);
        return data;
      }),

    reauthenticate: async (purpose: string, getIdentityToken: (challenge: string) => Promise<string>) => {
      const challenge = await apiFetch('/v1/auth/reauthenticate/challenge', {
        method: 'POST',
        body: JSON.stringify({ purpose }),
      });
      const identityToken = await getIdentityToken(challenge.challenge);
      return apiFetch('/v1/auth/reauthenticate', {
        method: 'POST',
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          challenge: challenge.challenge,
          identityToken,
          purpose,
        }),
      });
    },

    getEligibility: () => apiFetch('/v1/auth/eligibility'),

    recordEligibility: () => apiFetch('/v1/auth/eligibility', { method: 'POST' }),

    declineEligibility: () => apiFetch('/v1/auth/eligibility/decline', { method: 'POST' }),

    logout: async () => {
      try {
        await apiFetch('/v1/auth/logout', { method: 'POST' });
      } catch {}
      await clearTokens();
    },
  },

  boxes: {
    list: () => apiFetch('/v1/boxes'),
    create: (name: string, areaId?: string, clientMutationId?: string) => apiFetch('/v1/boxes', { method: 'POST', body: JSON.stringify({ name, areaId, clientMutationId }) }),
    rename: (id: string, name: string, areaId?: string, clientMutationId?: string) => apiFetch(`/v1/boxes/${id}`, { method: 'PATCH', body: JSON.stringify({ name, areaId, clientMutationId }) }),
    archive: (id: string, clientMutationId?: string) => apiFetch(`/v1/boxes/${id}`, { method: 'PATCH', body: JSON.stringify({ isArchived: true, clientMutationId }) }),
    delete: (id: string, clientMutationId?: string) => apiFetch(`/v1/boxes/${id}`, { method: 'DELETE', body: JSON.stringify({ clientMutationId }) }),
  },

  areas: {
    list: () => apiFetch('/v1/areas'),
    create: (name: string, clientMutationId?: string) => apiFetch('/v1/areas', { method: 'POST', body: JSON.stringify({ name, clientMutationId }) }),
    rename: (id: string, name: string, clientMutationId?: string) => apiFetch(`/v1/areas/${id}`, { method: 'PATCH', body: JSON.stringify({ name, clientMutationId }) }),
    delete: (id: string, clientMutationId?: string) => apiFetch(`/v1/areas/${id}`, { method: 'DELETE', body: JSON.stringify({ clientMutationId }) }),
  },

  notes: {
    list: (boxId?: string, q?: string) => {
      let url = '/v1/notes';
      const params = new URLSearchParams();
      if (boxId) params.append('boxId', boxId);
      if (q) params.append('q', q);
      const queryStr = params.toString();
      if (queryStr) url += `?${queryStr}`;
      return apiFetch(url);
    },

    get: (id: string) => apiFetch(`/v1/notes/${id}`),

    create: (boxId: string, body: string, peopleNames: string[], clientMutationId?: string) =>
      apiFetch('/v1/notes', {
        method: 'POST',
        body: JSON.stringify({ boxId, body, peopleNames, clientMutationId }),
      }),

    edit: (id: string, body: string, clientMutationId?: string) =>
      apiFetch(`/v1/notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ body, clientMutationId }),
      }),

    delete: (id: string, clientMutationId?: string) => apiFetch(`/v1/notes/${id}`, { method: 'DELETE', body: JSON.stringify({ clientMutationId }) }),

    addMore: (id: string, body: string, clientMutationId?: string) =>
      apiFetch(`/v1/notes/${id}/add-more`, {
        method: 'POST',
        body: JSON.stringify({ body, clientMutationId }),
      }),
  },

  people: {
    list: () => apiFetch('/v1/people'),
    create: (name: string, clientMutationId?: string) => apiFetch('/v1/people', { method: 'POST', body: JSON.stringify({ name, clientMutationId }) }),
    rename: (id: string, name: string) => apiFetch(`/v1/people/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    delete: (id: string) => apiFetch(`/v1/people/${id}`, { method: 'DELETE' }),
  },

  receipts: {
    list: (noteId: string): Promise<ReceiptRecord[]> =>
      apiFetch(`/v1/receipts?noteId=${encodeURIComponent(noteId)}`),
    upload: uploadReceiptAsset,
    confirm: confirmReceiptUpload,
    delete: (receiptId: string): Promise<{ success: true }> =>
      apiFetch(`/v1/receipts/${encodeURIComponent(receiptId)}`, { method: 'DELETE' }),
    getOcr: (receiptId: string): Promise<ReceiptOcrResponse> =>
      apiFetch(`/v1/receipts/${encodeURIComponent(receiptId)}/ocr`),
    requestOcr: (receiptId: string): Promise<ReceiptOcrResponse> =>
      apiFetch(`/v1/receipts/${encodeURIComponent(receiptId)}/ocr`, { method: 'POST' }),
    deleteOcr: (receiptId: string): Promise<{ success: true }> =>
      apiFetch(`/v1/receipts/${encodeURIComponent(receiptId)}/ocr`, { method: 'DELETE' }),
  },

  search: {
    query: (query: string, options: { boxId?: string; page?: number; limit?: number } = {}): Promise<SearchResponse> => {
      const params = new URLSearchParams({ q: query });
      if (options.boxId) params.set('boxId', options.boxId);
      if (options.page) params.set('page', String(options.page));
      if (options.limit) params.set('limit', String(options.limit));
      return apiFetch(`/v1/search?${params.toString()}`);
    },
  },

  patterns: {
    list: (): Promise<PatternInsight[]> => apiFetch('/v1/patterns'),
    dismiss: (patternKey: string) => apiFetch('/v1/patterns/dismiss', {
      method: 'POST',
      body: JSON.stringify({ patternKey }),
    }),
    snooze: (patternKey: string, snoozedUntil: string) => apiFetch('/v1/patterns/snooze', {
      method: 'POST',
      body: JSON.stringify({ patternKey, snoozedUntil }),
    }),
  },

  perspectives: {
    generate: (
      noteId: string,
      intensity?: string,
      scope?: string,
      options: { useReceipts?: boolean } = {},
    ) =>
      apiFetch(`/v1/notes/${noteId}/perspectives`, {
        method: 'POST',
        body: JSON.stringify({ intensity, scope, useReceipts: options.useReceipts === true })
      }),
    get: (noteId: string) => apiFetch(`/v1/notes/${noteId}/perspectives`),
  },

  compliance: {
    updatePreferences: (prefs: {
      targetedAdsAllowed?: boolean;
      saleOrShareAllowed?: boolean;
      aiProcessingAllowed?: boolean;
      thirdPartyAiAllowed?: boolean;
    }) => apiFetch('/v1/privacy/preferences', { method: 'PATCH', body: JSON.stringify(prefs) }),

    optOut: () => apiFetch('/v1/privacy/opt-out', { method: 'POST' }),

    requestDataExport: () => apiFetch('/v1/privacy/export-request', { method: 'POST', body: JSON.stringify({ format: 'zip' }) }),

    getDataExportStatus: (ticketId: string): Promise<ExportStatusResponse> => apiFetch(`/v1/privacy/export-request/${encodeURIComponent(ticketId)}`),

    downloadDataExport: (downloadUrl: string): Promise<Uint8Array> => downloadAuthenticatedExport(downloadUrl),

    fileDSAR: (requestType: string) =>
      apiFetch('/v1/privacy/request', {
        method: 'POST',
        body: JSON.stringify({ requestType }),
      }),

    deleteAccount: () => apiFetch('/v1/account/delete', { method: 'POST' }),

    getDeletionStatus: (statusToken: string): Promise<DeletionStatusResponse> => apiFetch('/v1/privacy/delete/status', {
      headers: { Authorization: `DeletionStatus ${statusToken}` },
    }),
  },

  entitlements: {
    get: () => apiFetch('/v1/entitlements/me'),
  },

  storekit: {
    getPurchaseContext: (): Promise<{ appAccountToken: string }> => apiFetch('/v1/entitlements/me'),
    sync: (signedTransactions: string[]) => apiFetch('/v1/storekit/transactions/sync', {
      method: 'POST',
      body: JSON.stringify({ signedTransactions }),
    }),
  },
};

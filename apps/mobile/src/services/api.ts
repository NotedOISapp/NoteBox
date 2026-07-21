import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

export interface AppleCredentialPayload {
  identityToken: string;
  appleId?: string;
  authorizationCode?: string | null;
  email?: string | null;
  displayName?: string | null;
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

  perspectives: {
    generate: (noteId: string, intensity?: string, scope?: string) =>
      apiFetch(`/v1/notes/${noteId}/perspectives`, {
        method: 'POST',
        body: JSON.stringify({ intensity, scope })
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

    getDataExportStatus: (ticketId: string) => apiFetch(`/v1/privacy/export-request/${encodeURIComponent(ticketId)}`),

    fileDSAR: (requestType: string) =>
      apiFetch('/v1/privacy/request', {
        method: 'POST',
        body: JSON.stringify({ requestType }),
      }),

    deleteAccount: () => apiFetch('/v1/account/delete', { method: 'POST' }),

    getDeletionStatus: (statusToken: string) => apiFetch('/v1/privacy/delete/status', {
      headers: { Authorization: `DeletionStatus ${statusToken}` },
    }),
  },

  entitlements: {
    get: () => apiFetch('/v1/entitlements/me'),
  },
};

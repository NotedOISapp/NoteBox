import { beforeEach, describe, expect, it, vi } from 'vitest';

const secureValues = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => secureValues.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => { secureValues.set(key, value); }),
  deleteItemAsync: vi.fn(async (key: string) => { secureValues.delete(key); }),
}));

vi.mock('expo-constants', () => ({
  default: { expoConfig: { hostUri: '192.168.1.12:8081' } },
}));

import { api, resolveApiBaseUrl } from '@/services/api';

describe('mobile API contract', () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'https://api.test.notebox';
    secureValues.clear();
    vi.restoreAllMocks();
  });

  it('uses the configured production URL and only derives a LAN URL in development', () => {
    expect(resolveApiBaseUrl('https://api.notebox.app/', undefined, false)).toBe('https://api.notebox.app');
    expect(resolveApiBaseUrl(undefined, '192.168.1.12:8081', true)).toBe('http://192.168.1.12:3001');
    expect(() => resolveApiBaseUrl(undefined, undefined, false)).toThrow(/EXPO_PUBLIC_API_URL/);
  });

  it('sends the real Apple credential fields required by the backend', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      accessToken: 'access', refreshToken: 'refresh', user: { ageAttested: false },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await api.auth.appleSignIn({
      appleId: 'apple-user',
      identityToken: 'signed-identity-token',
      authorizationCode: 'one-time-code',
      email: 'user@example.com',
      displayName: 'User Name',
    });

    const [, request] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(request?.body))).toEqual({
      appleId: 'apple-user',
      identityToken: 'signed-identity-token',
      authorizationCode: 'one-time-code',
      email: 'user@example.com',
      displayName: 'User Name',
    });
  });

  it('uses the challenge contract before a destructive privacy request', async () => {
    secureValues.set('access_token', 'access');
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ challengeId: 'challenge-id', challenge: 'nonce' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

    await api.auth.reauthenticate('account_deletion', async (nonce) => {
      expect(nonce).toBe('nonce');
      return 'fresh-identity-token';
    });

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('/v1/auth/reauthenticate/challenge'),
      expect.stringContaining('/v1/auth/reauthenticate'),
    ]);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      challengeId: 'challenge-id', challenge: 'nonce', identityToken: 'fresh-identity-token', purpose: 'account_deletion',
    });
  });

  it('uses canonical export and deletion lifecycle routes', async () => {
    secureValues.set('access_token', 'access');
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ status: 'pending' }), { status: 200 }),
    );

    await api.compliance.requestDataExport();
    await api.compliance.getDataExportStatus('ticket-1');
    await api.compliance.deleteAccount();
    await api.compliance.getDeletionStatus('deletion-token');

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('/v1/privacy/export-request'),
      expect.stringContaining('/v1/privacy/export-request/ticket-1'),
      expect.stringContaining('/v1/account/delete'),
      expect.stringContaining('/v1/privacy/delete/status'),
    ]);
    expect((fetchMock.mock.calls[3][1]?.headers as Record<string, string>).Authorization).toBe('DeletionStatus deletion-token');
  });
});

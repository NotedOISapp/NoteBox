import { beforeEach, describe, expect, it, vi } from 'vitest';

const { secureValues, authenticateAsync, hasHardwareAsync, isEnrolledAsync } = vi.hoisted(() => ({
  secureValues: new Map<string, string>(),
  authenticateAsync: vi.fn(async () => ({ success: true })),
  hasHardwareAsync: vi.fn(async () => true),
  isEnrolledAsync: vi.fn(async () => true),
}));

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: vi.fn(async (key: string) => secureValues.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => { secureValues.set(key, value); }),
  deleteItemAsync: vi.fn(async (key: string) => { secureValues.delete(key); }),
}));
vi.mock('expo-local-authentication', () => ({
  authenticateAsync,
  hasHardwareAsync,
  isEnrolledAsync,
}));

import {
  authenticatePrivacyLock,
  getPrivacyLockEnabled,
  setPrivacyLockEnabled,
  subscribeToPanicHide,
  triggerPanicHide,
} from '@/services/privacy-lock';

describe('privacy lock service', () => {
  beforeEach(() => {
    secureValues.clear();
    authenticateAsync.mockClear();
    hasHardwareAsync.mockResolvedValue(true);
    isEnrolledAsync.mockResolvedValue(true);
  });

  it('stores the setting in device-only secure storage', async () => {
    await setPrivacyLockEnabled(true);
    expect(await getPrivacyLockEnabled()).toBe(true);
    await setPrivacyLockEnabled(false);
    expect(await getPrivacyLockEnabled()).toBe(false);
  });

  it('fails closed when device authentication is unavailable', async () => {
    isEnrolledAsync.mockResolvedValue(false);
    expect(await authenticatePrivacyLock()).toBe(false);
    expect(authenticateAsync).not.toHaveBeenCalled();
  });

  it('notifies and unsubscribes panic-hide listeners', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToPanicHide(listener);
    triggerPanicHide();
    unsubscribe();
    triggerPanicHide();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

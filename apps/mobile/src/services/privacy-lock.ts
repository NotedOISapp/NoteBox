import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const PRIVACY_LOCK_KEY = 'notebox_privacy_lock_enabled';
const panicListeners = new Set<() => void>();

export async function getPrivacyLockEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return await SecureStore.getItemAsync(PRIVACY_LOCK_KEY) === 'true';
}

export async function setPrivacyLockEnabled(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  if (enabled) {
    await SecureStore.setItemAsync(PRIVACY_LOCK_KEY, 'true', {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } else {
    await SecureStore.deleteItemAsync(PRIVACY_LOCK_KEY);
  }
}

export async function authenticatePrivacyLock(reason = 'Unlock NoteBox'): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  if (!hasHardware || !isEnrolled) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: 'Keep Locked',
    disableDeviceFallback: false,
  });
  return result.success;
}

export function triggerPanicHide(): void {
  panicListeners.forEach((listener) => listener());
}

export function subscribeToPanicHide(listener: () => void): () => void {
  panicListeners.add(listener);
  return () => panicListeners.delete(listener);
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, bytesToUtf8, hexToBytes, utf8ToBytes } from '@noble/ciphers/utils.js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY_NAME = 'notebox_local_data_key_v1';
const ENVELOPE_VERSION = 1;
const memoryStorage = new Map<string, string>();

interface EncryptedEnvelope {
  version: 1;
  nonce: string;
  ciphertext: string;
}

export class SecureLocalDataError extends Error {
  constructor(message: string, readonly storageKey: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'SecureLocalDataError';
  }
}

async function getOrCreateEncryptionKey(): Promise<Uint8Array> {
  const stored = await SecureStore.getItemAsync(KEY_NAME);
  if (stored) return hexToBytes(stored);

  const key = await Crypto.getRandomBytesAsync(32);
  await SecureStore.setItemAsync(KEY_NAME, bytesToHex(key), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return key;
}

function parseEnvelope(raw: string): EncryptedEnvelope | null {
  try {
    const parsed = JSON.parse(raw) as Partial<EncryptedEnvelope>;
    if (parsed.version === ENVELOPE_VERSION && typeof parsed.nonce === 'string' && typeof parsed.ciphertext === 'string') {
      return parsed as EncryptedEnvelope;
    }
  } catch {
    // Legacy plaintext is deliberately handled by the migration path below.
  }
  return null;
}

export async function setEncryptedItem(storageKey: string, plaintext: string): Promise<void> {
  if (Platform.OS === 'web') {
    memoryStorage.set(storageKey, plaintext);
    return;
  }

  const key = await getOrCreateEncryptionKey();
  const nonce = await Crypto.getRandomBytesAsync(12);
  const cipher = gcm(key, nonce, utf8ToBytes(storageKey));
  const ciphertext = cipher.encrypt(utf8ToBytes(plaintext));
  const envelope: EncryptedEnvelope = {
    version: ENVELOPE_VERSION,
    nonce: bytesToHex(nonce),
    ciphertext: bytesToHex(ciphertext),
  };
  await AsyncStorage.setItem(storageKey, JSON.stringify(envelope));
}

export async function getEncryptedItem(storageKey: string): Promise<string | null> {
  if (Platform.OS === 'web') return memoryStorage.get(storageKey) ?? null;

  const raw = await AsyncStorage.getItem(storageKey);
  if (raw === null) return null;

  const envelope = parseEnvelope(raw);
  if (!envelope) {
    // One-time migration from the legacy plaintext cache. The original value is
    // replaced only after authenticated encryption succeeds.
    await setEncryptedItem(storageKey, raw);
    return raw;
  }

  try {
    const key = await getOrCreateEncryptionKey();
    const cipher = gcm(key, hexToBytes(envelope.nonce), utf8ToBytes(storageKey));
    return bytesToUtf8(cipher.decrypt(hexToBytes(envelope.ciphertext)));
  } catch (cause) {
    throw new SecureLocalDataError('Encrypted local data could not be authenticated. The stored value was preserved.', storageKey, { cause });
  }
}

export async function removeEncryptedItem(storageKey: string): Promise<void> {
  memoryStorage.delete(storageKey);
  await AsyncStorage.removeItem(storageKey);
}

export async function setEncryptedJson(storageKey: string, value: unknown): Promise<void> {
  await setEncryptedItem(storageKey, JSON.stringify(value));
}

export async function getEncryptedJson<T>(storageKey: string): Promise<T | null> {
  const value = await getEncryptedItem(storageKey);
  if (value === null) return null;
  try {
    return JSON.parse(value) as T;
  } catch (cause) {
    throw new SecureLocalDataError('Encrypted local data contains invalid JSON. The stored value was preserved.', storageKey, { cause });
  }
}

export async function clearLocalEncryptionKey(): Promise<void> {
  memoryStorage.clear();
  await SecureStore.deleteItemAsync(KEY_NAME);
}

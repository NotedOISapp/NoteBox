import { beforeEach, describe, expect, it, vi } from 'vitest';

const asyncValues = new Map<string, string>();
const secureValues = new Map<string, string>();
let randomSeed = 1;

vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => asyncValues.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { asyncValues.set(key, value); }),
    removeItem: vi.fn(async (key: string) => { asyncValues.delete(key); }),
  },
}));
vi.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: vi.fn(async (key: string) => secureValues.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => { secureValues.set(key, value); }),
  deleteItemAsync: vi.fn(async (key: string) => { secureValues.delete(key); }),
}));
vi.mock('expo-crypto', () => ({
  getRandomBytesAsync: vi.fn(async (length: number) => {
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) bytes[index] = (randomSeed + index) % 256;
    randomSeed += length;
    return bytes;
  }),
}));

import {
  SecureLocalDataError,
  getEncryptedItem,
  getEncryptedJson,
  setEncryptedItem,
  setEncryptedJson,
} from '@/services/secure-local-storage';

describe('encrypted local storage', () => {
  beforeEach(() => {
    asyncValues.clear();
    secureValues.clear();
    randomSeed = 1;
  });

  it('stores authenticated ciphertext instead of plaintext and decrypts it', async () => {
    await setEncryptedJson('domain-notes', [{ body: 'private words' }]);

    const stored = asyncValues.get('domain-notes');
    expect(stored).toBeTruthy();
    expect(stored).not.toContain('private words');
    expect(await getEncryptedJson('domain-notes')).toEqual([{ body: 'private words' }]);
  });

  it('migrates legacy plaintext only after it can be encrypted', async () => {
    asyncValues.set('legacy', 'old local value');

    expect(await getEncryptedItem('legacy')).toBe('old local value');
    expect(asyncValues.get('legacy')).not.toBe('old local value');
  });

  it('preserves tampered ciphertext and fails closed', async () => {
    await setEncryptedItem('draft', 'sensitive draft');
    const envelope = JSON.parse(asyncValues.get('draft')!);
    envelope.ciphertext = `${envelope.ciphertext.slice(0, -2)}00`;
    const tampered = JSON.stringify(envelope);
    asyncValues.set('draft', tampered);

    await expect(getEncryptedItem('draft')).rejects.toBeInstanceOf(SecureLocalDataError);
    expect(asyncValues.get('draft')).toBe(tampered);
  });

  it('binds ciphertext to its storage key', async () => {
    await setEncryptedItem('first-key', 'secret');
    asyncValues.set('second-key', asyncValues.get('first-key')!);

    await expect(getEncryptedItem('second-key')).rejects.toBeInstanceOf(SecureLocalDataError);
  });
});

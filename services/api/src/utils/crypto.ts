import crypto from 'crypto';
import { FIELD_ENCRYPTION_KEY } from '../config/env.js';


const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

// Load key from env, ensure it is 32 bytes (64 hex characters)
const hexKey = FIELD_ENCRYPTION_KEY;
let key = Buffer.from(hexKey, 'hex');
if (key.length !== 32) {
  // Fallback to hashing the key to make it exactly 32 bytes if misconfigured
  key = crypto.createHash('sha256').update(hexKey).digest();
}

/**
 * Encrypts a clear text string using AES-256-GCM.
 * Format returned: iv_hex:auth_tag_hex:encrypted_text_hex
 */
export function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a cipher text string format (iv:tag:content) using AES-256-GCM.
 */
export function decrypt(cipherText: string): string {
  if (!cipherText) return '';

  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    // If not matching the format, return the string as-is (e.g. if plain text is encountered)
    return cipherText;
  }

  const [ivHex, tagHex, encryptedHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encryptedText = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Creates a sha256 hash of a string (primarily email) for index lookups.
 */
export function sha256Hash(text: string): string {
  if (!text) return '';
  return crypto.createHash('sha256').update(text.toLowerCase().trim()).digest('hex');
}

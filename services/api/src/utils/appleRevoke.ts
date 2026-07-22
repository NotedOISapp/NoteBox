import { logInfo } from './logger.js';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import {
  APPLE_CLIENT_ID,
  APPLE_KEY_ID,
  APPLE_PRIVATE_KEY_PATH,
  APPLE_TEAM_ID,
} from '../config/env.js';

function createAppleClientSecret(): string {
  if (!APPLE_CLIENT_ID || !APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY_PATH) {
    throw new Error('APPLE_OAUTH_NOT_CONFIGURED');
  }
  const privateKeyPath = path.resolve(APPLE_PRIVATE_KEY_PATH);
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    keyid: APPLE_KEY_ID,
    issuer: APPLE_TEAM_ID,
    audience: 'https://appleid.apple.com',
    subject: APPLE_CLIENT_ID,
    expiresIn: '5m',
  });
}

async function postAppleForm(endpoint: 'token' | 'revoke', values: Record<string, string>): Promise<any> {
  const response = await fetch(`https://appleid.apple.com/auth/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values).toString(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`APPLE_${endpoint.toUpperCase()}_FAILED`);
  }
  return payload;
}

/**
 * Exchange Apple authorization code for tokens server-side.
 */
export async function exchangeAppleCode(code: string): Promise<{ accessToken: string; refreshToken: string }> {
  // Never log raw code.
  logInfo('[AppleRevoke] Exchanging Apple authorization code.');

  if (process.env.NODE_ENV === 'test') {
    return {
      accessToken: 'mock_apple_access_token_123',
      refreshToken: 'mock_apple_refresh_token_123',
    };
  }

  const payload = await postAppleForm('token', {
    client_id: APPLE_CLIENT_ID,
    client_secret: createAppleClientSecret(),
    code,
    grant_type: 'authorization_code',
  });
  if (typeof payload.access_token !== 'string' || typeof payload.refresh_token !== 'string') {
    throw new Error('APPLE_TOKEN_RESPONSE_INVALID');
  }
  return { accessToken: payload.access_token, refreshToken: payload.refresh_token };
}

/**
 * Revokes Sign in with Apple OAuth tokens.
 * Must accept a token, not appleId.
 */
export async function revokeAppleToken(token: string): Promise<boolean> {
  if (!token) return false;

  // Never log the raw token, client secrets, keys, or subjects.
  logInfo('[AppleRevoke] Initiating Apple token revocation.');

  if (process.env.NODE_ENV === 'test') {
    if (token === 'force_fail_token') {
      throw new Error('Simulated Apple API Error');
    }
    return true;
  }

  await postAppleForm('revoke', {
    client_id: APPLE_CLIENT_ID,
    client_secret: createAppleClientSecret(),
    token,
    token_type_hint: 'refresh_token',
  });
  return true;
}

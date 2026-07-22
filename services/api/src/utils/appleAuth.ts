import crypto from 'crypto';
import https from 'https';
import jwt from 'jsonwebtoken';
import { isProd } from '../config/env.js';

let appleKeysCache: any[] = [];
let cacheExpiresAt = 0;

// Dynamically generate a key pair for the test environment
export let testPublicKey: crypto.KeyObject | null = null;
export let testPrivateKey: string | null = null;

if (!isProd) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });
  testPublicKey = crypto.createPublicKey(publicKey);
  testPrivateKey = privateKey;
}

async function fetchAppleKeys(): Promise<any[]> {
  if (appleKeysCache.length > 0 && Date.now() < cacheExpiresAt) {
    return appleKeysCache;
  }

  return new Promise((resolve, reject) => {
    https.get('https://appleid.apple.com/auth/keys', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          appleKeysCache = json.keys || [];
          cacheExpiresAt = Date.now() + 24 * 60 * 60 * 1000; // Cache for 24 hours
          resolve(appleKeysCache);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

/**
 * Cryptographically verifies a Sign in with Apple identity token.
 * Production mode strictly verifies signature using Apple's JWKS.
 * Test/Dev mode verifies against dynamically generated test key pair.
 */
export async function verifyAppleIdentityToken(
  token: string,
  expectedNonce: string,
  subjectToMatch: string
): Promise<any> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string' || !decoded.header || !decoded.payload) {
    throw new Error('Invalid JWT format');
  }

  const payload = decoded.payload as any;
  const header = decoded.header as any;

  // 1. Verify claims
  const expectedIssuer = 'https://appleid.apple.com';
  const dynamicIsProd = process.env.NODE_ENV === 'production';
  if (dynamicIsProd) {
    if (payload.iss !== expectedIssuer) {
      throw new Error('Invalid token issuer');
    }
  } else {
    // In dev/test, allow test issuer or production issuer
    if (payload.iss !== expectedIssuer && payload.iss !== 'test-apple-issuer') {
      throw new Error('Invalid token issuer (development)');
    }
  }

  if (payload.aud !== 'com.notebox.app') {
    throw new Error('Apple identity token audience mismatch');
  }

  if (payload.exp && Date.now() >= payload.exp * 1000) {
    throw new Error('Apple identity token expired');
  }

  if (payload.sub !== subjectToMatch) {
    throw new Error('Apple identity token subject mismatch');
  }

  if (expectedNonce) {
    const challengeHash = crypto.createHash('sha256').update(expectedNonce).digest('hex');
    if (payload.nonce !== expectedNonce && payload.nonce !== challengeHash) {
      throw new Error('Apple identity token nonce mismatch');
    }
  }

  // 2. Cryptographic signature verification
  if (dynamicIsProd) {
    // In production, reject any test key ids or test headers
    if (header.kid === 'test-key-id') {
      throw new Error('Production Security Violation: Test keys are rejected in production.');
    }
    const keys = await fetchAppleKeys();
    const keySpec = keys.find(k => k.kid === header.kid);
    if (!keySpec) {
      throw new Error('Matching Apple public key not found');
    }

    const publicKey = crypto.createPublicKey({
      format: 'jwk',
      key: keySpec
    });

    jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: expectedIssuer,
    });
  } else {
    // In dev/test, if signed by test-key-id, verify using testPublicKey
    if (header.kid === 'test-key-id' && testPublicKey) {
      jwt.verify(token, testPublicKey, {
        algorithms: ['RS256']
      });
    } else {
      throw new Error('Signature verification failed (development)');
    }
  }

  return payload;
}

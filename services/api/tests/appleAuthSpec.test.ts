import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { db } from '../src/db/index.js';
import { users, sessions, reauthenticationChallenges } from '../src/db/schema.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { generateMockAppleToken } from '../src/utils/appleTestAuth.js';
import { verifyAppleIdentityToken, testPublicKey } from '../src/utils/appleAuth.js';
import { eq } from 'drizzle-orm';

describe('Sign in with Apple Cryptographic & Challenge Verification (Part 2)', () => {
  let token: string;
  let userId: string;
  let sessionId: string;
  const appleId = 'apple_spec_user';

  beforeAll(async () => {
    const identityToken = generateMockAppleToken({ sub: appleId });
    const res = await request(app)
      .post('/v1/auth/apple')
      .send({ identityToken, appleId, displayName: 'Apple Spec User' });
    expect(res.status).toBe(200);
    token = res.body.accessToken;

    const payload = jwt.decode(token) as any;
    userId = payload.userId;
    sessionId = payload.sessionId;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ attestAdult: true });
  });

  it('verifies a valid signed test credential', async () => {
    const nonce = 'valid_nonce';
    const identityToken = generateMockAppleToken({ sub: appleId, nonce });
    const payload = await verifyAppleIdentityToken(identityToken, nonce, appleId);
    expect(payload.sub).toBe(appleId);
    expect(payload.nonce).toBe(nonce);
  });

  it('rejects an invalid signature', async () => {
    const nonce = 'valid_nonce';
    const validToken = generateMockAppleToken({ sub: appleId, nonce });
    const parts = validToken.split('.');
    const corruptedToken = `${parts[0]}.${parts[1]}.CorruptedSignatureHere`;
    await expect(verifyAppleIdentityToken(corruptedToken, nonce, appleId)).rejects.toThrow();
  });

  it('rejects wrong issuer', async () => {
    const nonce = 'valid_nonce';
    const identityToken = generateMockAppleToken({ sub: appleId, nonce, iss: 'https://wrong-issuer.com' });
    await expect(verifyAppleIdentityToken(identityToken, nonce, appleId)).rejects.toThrow('Invalid token issuer');
  });

  it('rejects wrong audience', async () => {
    const nonce = 'valid_nonce';
    const identityToken = generateMockAppleToken({ sub: appleId, nonce, aud: 'wrong-audience' });
    await expect(verifyAppleIdentityToken(identityToken, nonce, appleId)).rejects.toThrow();
  });

  it('rejects wrong subject', async () => {
    const nonce = 'valid_nonce';
    const identityToken = generateMockAppleToken({ sub: 'wrong_subject', nonce });
    await expect(verifyAppleIdentityToken(identityToken, nonce, appleId)).rejects.toThrow('subject mismatch');
  });

  it('rejects wrong nonce', async () => {
    const nonce = 'valid_nonce';
    const identityToken = generateMockAppleToken({ sub: appleId, nonce: 'wrong_nonce' });
    await expect(verifyAppleIdentityToken(identityToken, nonce, appleId)).rejects.toThrow('nonce mismatch');
  });

  it('rejects expired token', async () => {
    const nonce = 'valid_nonce';
    const identityToken = generateMockAppleToken({ sub: appleId, nonce, exp: Math.floor(Date.now() / 1000) - 10 });
    await expect(verifyAppleIdentityToken(identityToken, nonce, appleId)).rejects.toThrow('identity token expired');
  });

  it('rejects wrong challenge purpose', async () => {
    // Create challenge for purpose 'purpose_A'
    const challengeRes = await request(app)
      .post('/v1/auth/reauthenticate/challenge')
      .set('Authorization', `Bearer ${token}`)
      .send({ purpose: 'purpose_A' });
    const { challengeId, challenge } = challengeRes.body;

    const mockIdentityToken = generateMockAppleToken({ sub: appleId, nonce: challenge });

    // Submit with purpose 'purpose_B'
    const verifyRes = await request(app)
      .post('/v1/auth/reauthenticate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        challengeId,
        challenge,
        identityToken: mockIdentityToken,
        purpose: 'purpose_B'
      });
    expect(verifyRes.status).toBe(401);
  });

  it('rejects expired challenge', async () => {
    // Manually insert an expired challenge
    const challengeId = crypto.randomUUID();
    const challenge = 'expired_challenge';
    const challengeHash = crypto.createHash('sha256').update(challenge).digest('hex');

    await db.insert(reauthenticationChallenges).values({
      id: challengeId,
      sessionId,
      userId,
      purpose: 'test_expired',
      challengeHash,
      expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
    });

    const mockIdentityToken = generateMockAppleToken({ sub: appleId, nonce: challenge });

    const verifyRes = await request(app)
      .post('/v1/auth/reauthenticate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        challengeId,
        challenge,
        identityToken: mockIdentityToken,
      });
    expect(verifyRes.status).toBe(401);
  });

  it('rejects concurrent challenge use (replay/reuse prevention)', async () => {
    const challengeRes = await request(app)
      .post('/v1/auth/reauthenticate/challenge')
      .set('Authorization', `Bearer ${token}`)
      .send({ purpose: 'reauth_reuse' });
    const { challengeId, challenge } = challengeRes.body;

    const mockIdentityToken = generateMockAppleToken({ sub: appleId, nonce: challenge });

    // Consumes challenge first time
    const verifyRes1 = await request(app)
      .post('/v1/auth/reauthenticate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        challengeId,
        challenge,
        identityToken: mockIdentityToken,
      });
    expect(verifyRes1.status).toBe(200);

    // Tries to consume the same challenge second time
    const verifyRes2 = await request(app)
      .post('/v1/auth/reauthenticate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        challengeId,
        challenge,
        identityToken: mockIdentityToken,
      });
    expect(verifyRes2.status).toBe(401);
  });

  it('rejects test key outside test mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      // Temporarily change env to production
      process.env.NODE_ENV = 'production';

      const nonce = 'valid_nonce';
      const identityToken = generateMockAppleToken({ sub: appleId, nonce });

      // Verification should fail because test keys are strictly rejected in production mode
      await expect(verifyAppleIdentityToken(identityToken, nonce, appleId)).rejects.toThrow(
        'Production Security Violation: Test keys are rejected in production.'
      );
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});

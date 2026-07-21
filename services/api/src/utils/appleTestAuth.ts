import jwt from 'jsonwebtoken';
import supertest from 'supertest';
import { testPrivateKey } from './appleAuth.js';

if (process.env.NODE_ENV !== 'test') {
  throw new Error('Test helper only available in test mode.');
}

export function generateMockAppleToken(payload: {
  iss?: string;
  sub: string;
  aud?: string;
  nonce?: string;
  exp?: number;
}) {
  if (!testPrivateKey) {
    throw new Error('Test private key is not initialized.');
  }

  const defaultPayload = {
    iss: 'https://appleid.apple.com',
    aud: 'com.notebox.app',
    exp: Math.floor(Date.now() / 1000) + 300,
    ...payload,
  };

  return jwt.sign(defaultPayload, testPrivateKey, {
    algorithm: 'RS256',
    keyid: 'test-key-id',
  });
}

export async function reauthenticateUser(app: any, token: string, appleId: string) {
  const challengeRes = await supertest(app)
    .post('/v1/auth/reauthenticate/challenge')
    .set('Authorization', `Bearer ${token}`)
    .send({ purpose: 'test_reauth' });

  if (challengeRes.status !== 200) {
    throw new Error(`Failed to request reauth challenge: ${JSON.stringify(challengeRes.body)}`);
  }

  const { challengeId, challenge } = challengeRes.body;

  const mockIdentityToken = generateMockAppleToken({
    sub: appleId,
    nonce: challenge,
  });

  const verifyRes = await supertest(app)
    .post('/v1/auth/reauthenticate')
    .set('Authorization', `Bearer ${token}`)
    .send({
      challengeId,
      challenge,
      identityToken: mockIdentityToken,
    });

  if (verifyRes.status !== 200) {
    throw new Error(`Reauthentication verification failed: ${JSON.stringify(verifyRes.body)}`);
  }
}

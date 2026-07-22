import { describe, it, test, expect } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { generateMockAppleToken } from '../utils/appleTestAuth.js';

describe('Retired date-of-birth age gate', () => {

  test('stays retired when the legacy secret is missing', async () => {
    const original = process.env.AGE_GATE_SECRET;
    delete process.env.AGE_GATE_SECRET;
    const res = await request(app).post('/v1/auth/age-gate').send({ month: 1, year: 1990 });
    expect(res.status).toBe(410);
    process.env.AGE_GATE_SECRET = original;
  });

  test('stays retired when the legacy secret is empty', async () => {
    const original = process.env.AGE_GATE_SECRET;
    process.env.AGE_GATE_SECRET = '';
    const res = await request(app).post('/v1/auth/age-gate').send({ month: 1, year: 1990 });
    expect(res.status).toBe(410);
    process.env.AGE_GATE_SECRET = original;
  });

  test('stays retired when the legacy secret is malformed', async () => {
    const original = process.env.AGE_GATE_SECRET;
    process.env.AGE_GATE_SECRET = 'short';
    const res = await request(app).post('/v1/auth/age-gate').send({ month: 1, year: 1990 });
    expect(res.status).toBe(410);
    process.env.AGE_GATE_SECRET = original;
  });

  test('Valid AGE_GATE_SECRET allows successful age‑gate', async () => {
    process.env.AGE_GATE_SECRET = 'a'.repeat(32);
    const res = await request(app).post('/v1/auth/age-gate').send({ month: 1, year: 1990 });
    expect(res.status).toBe(410);
    expect(res.body.error).toBe('EndpointRetired');
    expect(res.body).not.toHaveProperty('ageGateToken');
  });

  test('does not validate or retain legacy date payloads', async () => {
    const res = await request(app).post('/v1/auth/age-gate').send({ month: 13, year: 2025 });
    expect(res.status).toBe(410);
  });
});

describe('Auth / JWT / Session behavior', () => {
  let accessToken: string;
  let refreshToken: string;

  it('authenticates user via Apple Sign-In and returns JWT tokens', async () => {
    const appleId = 'auth_test_user_1';
    const identityToken = generateMockAppleToken({ sub: appleId });
    const res = await request(app)
      .post('/v1/auth/apple')
      .send({ identityToken, appleId, displayName: 'Auth Test User' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('refreshes token session successfully with valid refreshToken', async () => {
    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });

  it('gets eligibility status successfully', async () => {
    const res = await request(app)
      .get('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ageAttested');
  });

  it('attests adult eligibility with valid bearer token', async () => {
    const res = await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ attestAdult: true });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('declines eligibility and deletes stub', async () => {
    // Authenticate another user to decline
    const appleIdDec = 'auth_decline_user';
    const identityTokenDec = generateMockAppleToken({ sub: appleIdDec });
    const resAuth = await request(app)
      .post('/v1/auth/apple')
      .send({ identityToken: identityTokenDec, appleId: appleIdDec, displayName: 'Declining User' });
    const decToken = resAuth.body.accessToken;

    const res = await request(app)
      .post('/v1/auth/eligibility/decline')
      .set('Authorization', `Bearer ${decToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects apple sign-in without identityToken', async () => {
    const res = await request(app)
      .post('/v1/auth/apple')
      .send({ appleId: 'auth_no_token_user', displayName: 'No Token' });
    expect(res.status).toBe(400);
  });

  it('rejects refresh request with missing token', async () => {
    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects refresh request with invalid token', async () => {
    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken: 'invalid-token' });
    expect(res.status).toBe(401);
  });

  it('logs out user and revokes session', async () => {
    const res = await request(app)
      .post('/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });
});

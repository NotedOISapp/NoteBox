import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { reauthenticateUser, generateMockAppleToken } from '../utils/appleTestAuth.js';

describe('Compliance Route Tests', () => {
  let token: string;

  beforeAll(async () => {
    const appleId = 'compliance_test_user';
    const identityToken = generateMockAppleToken({ sub: appleId });
    const resAuth = await request(app)
      .post('/v1/auth/apple')
      .send({ identityToken, appleId, displayName: 'Compliance Test User' });
    token = resAuth.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ attestAdult: true });

    await reauthenticateUser(app, token, 'compliance_test_user');
  });

  it('updates general privacy preferences via PATCH /v1/privacy/preferences', async () => {
    const res = await request(app)
      .patch('/v1/privacy/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetedAdsAllowed: false, aiProcessingAllowed: true });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('records append-only consent events via PATCH /v1/privacy/consent', async () => {
    const res = await request(app)
      .patch('/v1/privacy/consent')
      .set('Authorization', `Bearer ${token}`)
      .send({ purpose: 'ai_processing', granted: true });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('submits Do Not Sell or Share request via POST /v1/privacy/opt-out', async () => {
    const res = await request(app)
      .post('/v1/privacy/opt-out')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('requests DSAR data export via POST /v1/privacy/export-request', async () => {
    const res = await request(app)
      .post('/v1/privacy/export-request')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('ticketId');
  });

  it('submits general DSAR request via POST /v1/privacy/request', async () => {
    const res = await request(app)
      .post('/v1/privacy/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ requestType: 'access' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

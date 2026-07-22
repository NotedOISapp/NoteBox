import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('Analytics Route Tests', () => {
  let token: string;

  beforeAll(async () => {
    const resAuth = await request(app)
      .post('/v1/auth/apple')
      .send({ appleId: 'analytics_test_user', displayName: 'Analytics Test User' });
    token = resAuth.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ attestAdult: true });
  });

  it('requires authenticated user', async () => {
    const res = await request(app)
      .post('/v1/analytics')
      .send({ event_type: 'app_launch' });
    expect(res.status).toBe(401);
  });

  it('rejects request with missing event_type', async () => {
    const res = await request(app)
      .post('/v1/analytics')
      .set('Authorization', `Bearer ${token}`)
      .send({ properties: { duration: 120 } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('successfully records analytics event', async () => {
    const res = await request(app)
      .post('/v1/analytics')
      .set('Authorization', `Bearer ${token}`)
      .send({ event_type: 'button_click', properties: { button_id: 'save_note' } });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

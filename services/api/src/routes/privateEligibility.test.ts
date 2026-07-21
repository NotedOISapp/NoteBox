import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('adult eligibility boundary for private routes', () => {
  it.each([
    ['get', '/v1/people'],
    ['get', '/v1/areas'],
    ['get', '/v1/search?q=test'],
    ['post', '/v1/analytics'],
    ['post', '/v1/founding-feedback'],
    ['post', '/v1/privacy/export-request'],
  ] as const)('rejects %s %s before self-attestation', async (method, path) => {
    const auth = await request(app)
      .post('/v1/auth/apple')
      .send({ appleId: `unattested_${method}_${Date.now()}`, displayName: 'Unattested User' });

    const res = await request(app)[method](path)
      .set('Authorization', `Bearer ${auth.body.accessToken}`)
      .send({});

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('EligibilityRequired');
  });
});

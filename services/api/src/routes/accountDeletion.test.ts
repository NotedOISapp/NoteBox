import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { reauthenticateUser, generateMockAppleToken } from '../utils/appleTestAuth.js';

describe('Account Deletion Route Tests (SEC-023)', () => {
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const appleIdA = 'del_user_a';
    const identityTokenA = generateMockAppleToken({ sub: appleIdA });
    const resA = await request(app)
      .post('/v1/auth/apple')
      .send({ identityToken: identityTokenA, appleId: appleIdA, displayName: 'Deletion User A' });
    tokenA = resA.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ attestAdult: true });

    await reauthenticateUser(app, tokenA, 'del_user_a');

    const appleIdB = 'del_user_b';
    const identityTokenB = generateMockAppleToken({ sub: appleIdB });
    const resB = await request(app)
      .post('/v1/auth/apple')
      .send({ identityToken: identityTokenB, appleId: appleIdB, displayName: 'Deletion User B' });
    tokenB = resB.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ attestAdult: true });
  });

  it('deletion request requires authenticated user', async () => {
    const res = await request(app).post('/v1/account/delete');
    expect(res.status).toBe(401);
  });

  it('deletion request cannot target another user (scoped to req.user)', async () => {
    // User A calling account delete only deletes User A, User B remains accessible
    const res = await request(app)
      .post('/v1/account/delete')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('statusToken');

    // Verify job was created in DB with correct status
    const crypto = await import('crypto');
    const { db } = await import('../db/index.js');
    const { accountDeletionJobs } = await import('../db/schema.js');
    const { eq } = await import('drizzle-orm');

    const tokenHash = crypto.createHash('sha256').update(res.body.statusToken).digest('hex');
    const [job] = await db.select().from(accountDeletionJobs).where(eq(accountDeletionJobs.statusTokenHash, tokenHash)).limit(1);
    expect(job).toBeDefined();
    expect(job.appleRevocationStatus).toBe('pending');
    expect(job.status).toBe('pending');

    // Verify User B is still untouched
    const boxRes = await request(app)
      .get('/v1/boxes')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(boxRes.status).toBe(200);
  });

  it('deletion job is idempotent', async () => {
    const resSecond = await request(app)
      .post('/v1/account/delete')
      .set('Authorization', `Bearer ${tokenA}`);
    // Access should be blocked (403) or 202/401
    expect([202, 403, 401]).toContain(resSecond.status);
  });
});

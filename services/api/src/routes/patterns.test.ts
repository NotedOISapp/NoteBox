import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { entitlements, userCampaignStates } from '../db/schema.js';
import { eq } from 'drizzle-orm';

describe('Patterns Route Tests', () => {
  let token: string;
  let userId: string;

  beforeAll(async () => {
    const resAuth = await request(app)
      .post('/v1/auth/apple')
      .send({ appleId: 'patterns_test_user', displayName: 'Patterns Test User' });
    token = resAuth.body.accessToken;
    userId = resAuth.body.user.id;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ attestAdult: true });
  });

  it('rejects scanning patterns on free plan with 402 PaymentRequired', async () => {
    // Revoke founding campaign eligibility to test free plan
    await db.update(userCampaignStates).set({ foundingCampaignEligible: false }).where(eq(userCampaignStates.userId, userId));

    const res = await request(app)
      .get('/v1/patterns')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(402);
    expect(res.body.error).toBe('PaymentRequired');
  });

  it('allows scanning patterns once upgraded to Pro (paid)', async () => {
    // Upgrade user to paid plan in entitlements
    const [existing] = await db.select().from(entitlements).where(eq(entitlements.userId, userId));
    if (existing) {
      await db.update(entitlements).set({ plan: 'paid' }).where(eq(entitlements.userId, userId));
    } else {
      await db.insert(entitlements).values({ userId, plan: 'paid' });
    }

    const res = await request(app)
      .get('/v1/patterns')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('dismisses a pattern insight', async () => {
    const res = await request(app)
      .post('/v1/patterns/dismiss')
      .set('Authorization', `Bearer ${token}`)
      .send({ patternKey: 'minimization' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('snoozes a pattern insight', async () => {
    const res = await request(app)
      .post('/v1/patterns/snooze')
      .set('Authorization', `Bearer ${token}`)
      .send({ patternKey: 'boundary_dispute' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

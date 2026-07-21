import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { entitlements, userCampaignStates } from '../db/schema.js';
import { eq } from 'drizzle-orm';

describe('Perspectives Route Tests', () => {
  let token: string;
  let userId: string;
  let boxId: string;
  let noteId: string;

  beforeAll(async () => {
    const resAuth = await request(app)
      .post('/v1/auth/apple')
      .send({ appleId: 'persp_test_user', displayName: 'Perspectives Test User' });
    token = resAuth.body.accessToken;
    userId = resAuth.body.user.id;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ attestAdult: true });

    // Upgrade user to paid plan in entitlements
    const [existing] = await db.select().from(entitlements).where(eq(entitlements.userId, userId));
    if (existing) {
      await db.update(entitlements).set({ plan: 'paid' }).where(eq(entitlements.userId, userId));
    } else {
      await db.insert(entitlements).values({ userId, plan: 'paid' });
    }

    const resBox = await request(app)
      .post('/v1/boxes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Perspectives Box' });
    boxId = resBox.body.id;

    const resNote = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ boxId, body: 'I asked for clarity about the plan and he got frustrated.' });
    noteId = resNote.body.id;
  });

  it('rejects generating perspectives if AI consent is not granted', async () => {
    const res = await request(app)
      .post(`/v1/notes/${noteId}/perspectives`)
      .set('Authorization', `Bearer ${token}`)
      .send({ intensity: 'bold' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('ConsentRequired');
  });

  it('generates perspectives once consent is granted', async () => {
    // Grant AI consent via preferences endpoint
    const prefRes = await request(app)
      .patch('/v1/privacy/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        aiProcessingAllowed: true,
        thirdPartyAiAllowed: true,
      });
    expect(prefRes.status).toBe(200);

    const res = await request(app)
      .post(`/v1/notes/${noteId}/perspectives`)
      .set('Authorization', `Bearer ${token}`)
      .send({ intensity: 'bold' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('perspectives');

    const unfiltered = res.body.perspectives.find((p: any) => p.perspectiveType === 'unfiltered');
    expect(unfiltered).toBeDefined();
    expect(unfiltered.intensity).toBeUndefined();
    expect(unfiltered.recordConfidence).toBeDefined();
    expect(unfiltered.accountabilityRead).toBeDefined();
    expect(unfiltered.contextStatus).toBeDefined();
    expect(unfiltered.hardRead).toBeDefined();
  });

  it('generates perspectives without sending intensity parameter', async () => {
    const resNote = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ boxId, body: 'Another note for testing perspectives without intensity' });
    const newNoteId = resNote.body.id;

    const res = await request(app)
      .post(`/v1/notes/${newNoteId}/perspectives`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('perspectives');

    const unfiltered = res.body.perspectives.find((p: any) => p.perspectiveType === 'unfiltered');
    expect(unfiltered).toBeDefined();
    expect(unfiltered.intensity).toBeUndefined();
    expect(unfiltered.recordConfidence).toBeDefined();
    expect(unfiltered.hardRead).toBeDefined();
  });

  it('lists existing perspectives for a note', async () => {
    const res = await request(app)
      .get(`/v1/notes/${noteId}/perspectives`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('perspectives');
    expect(Array.isArray(res.body.perspectives)).toBe(true);
    expect(res.body.perspectives.length).toBeGreaterThanOrEqual(1);
  });

  it('regenerates perspectives when POST is called again', async () => {
    // Downgrade plan to free and revoke founding eligibility to test the 1-regeneration limit
    await db.update(entitlements).set({ plan: 'free' }).where(eq(entitlements.userId, userId));
    await db.update(userCampaignStates).set({ foundingCampaignEligible: false }).where(eq(userCampaignStates.userId, userId));

    // First regeneration consumes the 1 allowed free regeneration credit
    const res1 = await request(app)
      .post(`/v1/notes/${noteId}/perspectives`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetState: 'aligned' });
    expect(res1.status).toBe(200);

    // Second regeneration exceeds the 1-regeneration limit for Free tier
    const res2 = await request(app)
      .post(`/v1/notes/${noteId}/perspectives`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetState: 'aligned' });
    expect(res2.status).toBe(402);
    expect(res2.body.error).toBe('PERSPECTIVE_REGEN_LIMIT_REACHED');
  });
});

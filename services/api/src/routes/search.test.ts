import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { ocrTexts, receipts } from '../db/schema.js';
import { encrypt } from '../utils/crypto.js';

describe('Search Route Tests', () => {
  let token: string;
  let userId: string;
  let boxId: string;
  let noteId: string;

  beforeAll(async () => {
    const resAuth = await request(app)
      .post('/v1/auth/apple')
      .send({ appleId: 'search_test_user', displayName: 'Search Test User' });
    token = resAuth.body.accessToken;
    userId = resAuth.body.user.id;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ attestAdult: true });

    const resBox = await request(app)
      .post('/v1/boxes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Searchable Box' });
    boxId = resBox.body.id;

    const note = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ boxId, body: 'The quick brown fox jumps over the lazy dog' });
    noteId = note.body.id;
  });

  it('rejects search request without query q parameter', async () => {
    const res = await request(app)
      .get('/v1/search')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('searches and finds matching note snippet', async () => {
    const res = await request(app)
      .get('/v1/search?q=fox')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.results.length).toBeGreaterThanOrEqual(1);
    expect(res.body.results[0].snippet).toContain('fox');
  });

  it('returns empty array for non-matching search term', async () => {
    const res = await request(app)
      .get('/v1/search?q=xylophone12345')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.results.length).toBe(0);
  });

  it('returns a navigable Box result when the Box title matches', async () => {
    const res = await request(app)
      .get('/v1/search?q=searchable')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.results).toContainEqual(expect.objectContaining({
      resultType: 'box',
      boxId,
      boxName: 'Searchable Box',
    }));
  });

  it('searches stored OCR text after explicit extraction even when AI processing consent is off', async () => {
    const [receipt] = await db.insert(receipts).values({
      noteId,
      userId,
      storageKey: `${userId}/${noteId}/search-ocr`,
      contentType: 'image/png',
      sha256: 'a'.repeat(64),
      sizeBytes: 128n,
      scanStatus: 'clean',
    }).returning();
    await db.insert(ocrTexts).values({
      receiptId: receipt.id,
      extractedText: encrypt('Invoice number ZX-4421'),
    });

    const res = await request(app)
      .get('/v1/search?q=ZX-4421')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.results).toContainEqual(expect.objectContaining({
      resultType: 'note',
      noteId,
      matchType: 'ocr_text',
    }));
  });
});

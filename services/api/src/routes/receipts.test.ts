import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { ocrTexts, privacyPreferences, receipts } from '../db/schema.js';
import { eq } from 'drizzle-orm';

describe('Receipts Route Tests', () => {
  let token: string;
  let boxId: string;
  let noteId: string;
  let receiptId: string;

  beforeAll(async () => {
    const resAuth = await request(app)
      .post('/v1/auth/apple')
      .send({ appleId: 'receipts_test_user', displayName: 'Receipts Test User' });
    token = resAuth.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ attestAdult: true });

    const resBox = await request(app)
      .post('/v1/boxes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Receipts Box' });
    boxId = resBox.body.id;

    const resNote = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ boxId, body: 'Note for receipt test' });
    noteId = resNote.body.id;
  });

  it('lists receipts initially empty', async () => {
    const res = await request(app)
      .get('/v1/receipts')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  let testReservationId: string;

  it('generates an upload URL for a valid note', async () => {
    const res = await request(app)
      .post('/v1/receipts/upload-url')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contentType: 'image/png',
        sizeBytes: 1024,
        noteId,
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('uploadUrl');
    expect(res.body).toHaveProperty('storageKey');
    expect(res.body).toHaveProperty('reservationId');
    testReservationId = res.body.reservationId;

    const uploadRes = await request(app)
      .put(res.body.uploadUrl)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'image/png')
      .send(Buffer.alloc(1024, 1));
    expect(uploadRes.status).toBe(201);
  });

  it('confirms receipt upload', async () => {
    const res = await request(app)
      .post('/v1/receipts/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reservationId: testReservationId,
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('receipt');
    expect(res.body.receipt.noteId).toBe(noteId);
    receiptId = res.body.receipt.id;
  });

  it('reports OCR as unavailable without persisting fabricated extracted text', async () => {
    await db.update(receipts).set({ scanStatus: 'clean' }).where(eq(receipts.id, receiptId));
    const [receipt] = await db.select().from(receipts).where(eq(receipts.id, receiptId)).limit(1);
    await db.update(privacyPreferences)
      .set({ aiProcessingAllowed: true })
      .where(eq(privacyPreferences.userId, receipt.userId));

    const res = await request(app)
      .post(`/v1/receipts/${receiptId}/ocr`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('OCR_UNAVAILABLE');
    const stored = await db.select().from(ocrTexts).where(eq(ocrTexts.receiptId, receiptId));
    expect(stored).toHaveLength(0);
  });

  it('deletes receipt via DELETE', async () => {
    const res = await request(app)
      .delete(`/v1/receipts/${receiptId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const listRes = await request(app)
      .get('/v1/receipts')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    const ids = listRes.body.map((r: any) => r.id);
    expect(ids).not.toContain(receiptId);
  });
});

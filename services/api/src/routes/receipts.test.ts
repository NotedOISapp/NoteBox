import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { ocrTexts, privacyPreferences, receipts } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { encrypt } from '../utils/crypto.js';

describe('Receipts Route Tests', () => {
  let token: string;
  let boxId: string;
  let noteId: string;
  let emptyNoteId: string;
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

    const emptyNote = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ boxId, body: 'Note without a Receipt' });
    emptyNoteId = emptyNote.body.id;
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

  it('lists only Receipts attached to the requested Note', async () => {
    const attached = await request(app)
      .get(`/v1/receipts?noteId=${noteId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(attached.status).toBe(200);
    expect(attached.body.map((receipt: { id: string }) => receipt.id)).toContain(receiptId);

    const empty = await request(app)
      .get(`/v1/receipts?noteId=${emptyNoteId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual([]);

    const noteList = await request(app)
      .get(`/v1/notes?boxId=${boxId}`)
      .set('Authorization', `Bearer ${token}`);
    const attachedNote = noteList.body.find((note: { id: string }) => note.id === noteId);
    expect(attachedNote.receiptsCount).toBe(1);
  });

  it('reports a pending safety scan as pollable OCR processing', async () => {
    const [receipt] = await db.select().from(receipts).where(eq(receipts.id, receiptId)).limit(1);
    await db.update(privacyPreferences)
      .set({ aiProcessingAllowed: true })
      .where(eq(privacyPreferences.userId, receipt.userId));

    const trigger = await request(app)
      .post(`/v1/receipts/${receiptId}/ocr`)
      .set('Authorization', `Bearer ${token}`);
    expect(trigger.status).toBe(202);
    expect(trigger.body).toMatchObject({
      status: 'processing',
      stage: 'security_scan',
    });
    expect(trigger.body.retryAfterSeconds).toBeGreaterThan(0);

    const status = await request(app)
      .get(`/v1/receipts/${receiptId}/ocr`)
      .set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      status: 'processing',
      stage: 'security_scan',
    });
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
    expect(res.body.status).toBe('unavailable');
    const stored = await db.select().from(ocrTexts).where(eq(ocrTexts.receiptId, receiptId));
    expect(stored).toHaveLength(0);
  });

  it('reads and deletes explicitly extracted OCR text without deleting the Receipt', async () => {
    await db.insert(ocrTexts).values({
      receiptId,
      extractedText: encrypt('Order 1042 total $18.50'),
    });

    const status = await request(app)
      .get(`/v1/receipts/${receiptId}/ocr`)
      .set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      status: 'ready',
      text: 'Order 1042 total $18.50',
    });

    const deletion = await request(app)
      .delete(`/v1/receipts/${receiptId}/ocr`)
      .set('Authorization', `Bearer ${token}`);
    expect(deletion.status).toBe(200);
    expect(deletion.body).toEqual({ success: true, status: 'not_requested' });

    const stored = await db.select().from(ocrTexts).where(eq(ocrTexts.receiptId, receiptId));
    expect(stored).toHaveLength(0);
    const [receipt] = await db.select().from(receipts).where(eq(receipts.id, receiptId)).limit(1);
    expect(receipt).toBeDefined();
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

    const noteRes = await request(app)
      .get(`/v1/notes/${noteId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(noteRes.body.receiptsCount).toBe(0);
  });
});

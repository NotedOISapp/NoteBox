import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { ocrTexts, privacyPreferences, receiptProcessingJobs, receipts, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { processPendingReceiptJobs } from '../services/receiptProcessingWorker.js';
import { getStorage } from '../compliance/storage.js';
import { RECEIPT_PROCESSING_MAX_BYTES } from '../config/env.js';
import {
  setReceiptProcessingTestProvider,
  type ReceiptProcessingProvider,
  type ReceiptProviderInput,
} from '../services/receiptProcessingProvider.js';

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

    // Receipt lifecycle cases create independent Notes so their scan/OCR state
    // cannot leak between tests. Limits are covered by their own route suites;
    // this fixture must not become order-dependent after the fifth Note.
    await db.update(users)
      .set({ role: 'developer' })
      .where(eq(users.id, resAuth.body.user.id));

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
      .send({ boxId, body: 'The store changed the agreed total after confirming the order, so I saved the Receipt for a clear record.' });
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

  const provider = (overrides: Partial<ReceiptProcessingProvider> = {}): ReceiptProcessingProvider => ({
    name: 'test-receipt-provider',
    scan: async () => ({ status: 'clean', code: 'SCAN_CLEAN', providerReference: 'scan-test' }),
    extractText: async () => ({ text: 'Order 1042 total $18.50', providerReference: 'ocr-test' }),
    ...overrides,
  });

  const createNoteAndReceipt = async (suffix: string, bytes = Buffer.from(`receipt-${suffix}`)) => {
    const createdNote = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ boxId, body: `Receipt lifecycle ${suffix}` });
    expect(createdNote.status).toBe(201);
    const authorization = await request(app)
      .post('/v1/receipts/upload-url')
      .set('Authorization', `Bearer ${token}`)
      .send({ contentType: 'image/png', sizeBytes: bytes.length, noteId: createdNote.body.id });
    expect(authorization.status).toBe(201);
    const upload = await request(app)
      .put(authorization.body.uploadUrl)
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'image/png')
      .send(bytes);
    expect(upload.status).toBe(201);
    const confirmation = await request(app)
      .post('/v1/receipts/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ reservationId: authorization.body.reservationId });
    expect(confirmation.status).toBe(201);
    return { noteId: createdNote.body.id as string, receiptId: confirmation.body.receipt.id as string };
  };

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
    expect(res.body.headers).toMatchObject({
      'content-length': '1024',
      'if-none-match': '*',
    });
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

  it('rejects a Receipt reservation that the processing worker cannot consume', async () => {
    const response = await request(app)
      .post('/v1/receipts/upload-url')
      .set('Authorization', `Bearer ${token}`)
      .send({
        contentType: 'image/png',
        sizeBytes: RECEIPT_PROCESSING_MAX_BYTES + 1,
        noteId,
      });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      error: 'RECEIPT_PROCESSING_SIZE_LIMIT',
      maxSizeBytes: RECEIPT_PROCESSING_MAX_BYTES,
    });
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
      .set({ aiProcessingAllowed: true, thirdPartyAiAllowed: true })
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

  it('moves a benign confirmed Receipt to clean through the leased production worker', async () => {
    let scanned: ReceiptProviderInput | null = null;
    let scanCalls = 0;
    setReceiptProcessingTestProvider(provider({
      scan: async (input) => {
        scanCalls++;
        scanned = input;
        return { status: 'clean', code: 'SCAN_CLEAN', providerReference: 'scan-benign' };
      },
    }));
    const claimed = await Promise.all([
      processPendingReceiptJobs({ maxJobs: 1, workerId: 'receipt-test-worker-a', receiptId }),
      processPendingReceiptJobs({ maxJobs: 1, workerId: 'receipt-test-worker-b', receiptId }),
    ]);
    expect(claimed.sort()).toEqual([0, 1]);
    expect(scanCalls).toBe(1);
    const [receipt] = await db.select().from(receipts).where(eq(receipts.id, receiptId)).limit(1);
    expect(receipt.scanStatus).toBe('clean');
    expect(scanned).toMatchObject({ receiptId, contentType: 'image/png', sizeBytes: 1024 });
    expect((scanned as ReceiptProviderInput | null)?.sha256).toMatch(/^[a-f0-9]{64}$/);
    const [job] = await db.select().from(receiptProcessingJobs).where(eq(receiptProcessingJobs.receiptId, receiptId));
    expect(job).toMatchObject({ jobType: 'scan', status: 'succeeded', attemptCount: 1 });
  });

  it('keeps clean and OCR processing bound to the confirmed bytes after a current-version overwrite', async () => {
    const originalBytes = Buffer.from('immutable-receipt-source');
    const replacementBytes = Buffer.alloc(originalBytes.length, 0x78);
    const target = await createNoteAndReceipt('immutable-version', originalBytes);
    setReceiptProcessingTestProvider(provider());
    await expect(processPendingReceiptJobs({ maxJobs: 1, receiptId: target.receiptId })).resolves.toBe(1);

    const [receipt] = await db.select().from(receipts).where(eq(receipts.id, target.receiptId));
    expect(receipt.scanStatus).toBe('clean');
    expect(receipt.providerObjectVersion).toBeTruthy();

    const storage = getStorage();
    await expect(storage.putObject({
      namespace: 'receipts',
      key: receipt.storageKey,
      stream: replacementBytes,
      contentType: receipt.contentType,
      ifNoneMatch: '*',
    })).rejects.toMatchObject({ code: 'STORAGE_OBJECT_ALREADY_EXISTS' });

    const replacement = await storage.putObject({
      namespace: 'receipts',
      key: receipt.storageKey,
      stream: replacementBytes,
      contentType: receipt.contentType,
    });
    expect(replacement.versionId).not.toBe(receipt.providerObjectVersion);

    await db.update(privacyPreferences)
      .set({ aiProcessingAllowed: true, thirdPartyAiAllowed: true })
      .where(eq(privacyPreferences.userId, receipt.userId));
    let processedBytes: Buffer | null = null;
    setReceiptProcessingTestProvider(provider({
      extractText: async (input) => {
        processedBytes = input.bytes;
        return { text: 'Immutable source', providerReference: 'ocr-exact-version' };
      },
    }));
    const requested = await request(app)
      .post(`/v1/receipts/${target.receiptId}/ocr`)
      .set('Authorization', `Bearer ${token}`);
    expect(requested.status).toBe(202);
    await expect(processPendingReceiptJobs({ maxJobs: 1, receiptId: target.receiptId })).resolves.toBe(1);
    expect(processedBytes).toEqual(originalBytes);
  });

  it('records a terminal OCR unavailable result when no provider is configured', async () => {
    setReceiptProcessingTestProvider(null);

    const requested = await request(app)
      .post(`/v1/receipts/${receiptId}/ocr`)
      .set('Authorization', `Bearer ${token}`);
    expect(requested.status).toBe(202);
    expect(requested.body.stage).toBe('text_extraction');
    await expect(processPendingReceiptJobs({ maxJobs: 1, receiptId })).resolves.toBe(1);
    const status = await request(app).get(`/v1/receipts/${receiptId}/ocr`).set('Authorization', `Bearer ${token}`);
    expect(status.body).toMatchObject({ status: 'unavailable', reason: 'OCR_PROVIDER_NOT_CONFIGURED' });
    const stored = await db.select().from(ocrTexts).where(eq(ocrTexts.receiptId, receiptId));
    expect(stored).toHaveLength(0);
  });

  it('creates exactly one encrypted OCR record through idempotent concurrent requests', async () => {
    let ocrCalls = 0;
    setReceiptProcessingTestProvider(provider({
      extractText: async () => {
        ocrCalls++;
        return { text: 'Order 1042 total $18.50', providerReference: 'ocr-ready' };
      },
    }));
    const [first, second] = await Promise.all([
      request(app).post(`/v1/receipts/${receiptId}/ocr`).set('Authorization', `Bearer ${token}`),
      request(app).post(`/v1/receipts/${receiptId}/ocr`).set('Authorization', `Bearer ${token}`),
    ]);
    expect(first.status).toBe(202);
    expect(second.status).toBe(202);
    await expect(processPendingReceiptJobs({ maxJobs: 5, receiptId })).resolves.toBe(1);
    await expect(processPendingReceiptJobs({ maxJobs: 5, receiptId })).resolves.toBe(0);
    expect(ocrCalls).toBe(1);

    const status = await request(app)
      .get(`/v1/receipts/${receiptId}/ocr`)
      .set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({
      status: 'ready',
      text: 'Order 1042 total $18.50',
    });

    const storedBeforeDelete = await db.select().from(ocrTexts).where(eq(ocrTexts.receiptId, receiptId));
    expect(storedBeforeDelete).toHaveLength(1);
    expect(storedBeforeDelete[0].extractedText).not.toContain('Order 1042');

    const search = await request(app).get('/v1/search?q=1042').set('Authorization', `Bearer ${token}`);
    expect(search.status).toBe(200);
    expect(search.body.results).toContainEqual(expect.objectContaining({ noteId, matchType: 'ocr_text' }));

    const perspective = await request(app)
      .post(`/v1/notes/${noteId}/perspectives`)
      .set('Authorization', `Bearer ${token}`)
      .send({ useReceipts: true });
    expect(perspective.status).toBe(200);

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

  it('moves a malicious Receipt to rejected without invoking OCR', async () => {
    const target = await createNoteAndReceipt('malicious');
    let ocrCalls = 0;
    setReceiptProcessingTestProvider(provider({
      scan: async () => ({ status: 'rejected', code: 'MALWARE_DETECTED', providerReference: 'scan-malicious' }),
      extractText: async () => {
        ocrCalls++;
        return { text: 'must not run', providerReference: null };
      },
    }));
    await processPendingReceiptJobs({ maxJobs: 1, receiptId: target.receiptId });
    const [stored] = await db.select().from(receipts).where(eq(receipts.id, target.receiptId));
    expect(stored.scanStatus).toBe('rejected');
    const requestOcr = await request(app)
      .post(`/v1/receipts/${target.receiptId}/ocr`)
      .set('Authorization', `Bearer ${token}`);
    expect(requestOcr.status).toBe(422);
    expect(requestOcr.body.error).toBe('RECEIPT_REJECTED');
    expect(ocrCalls).toBe(0);
  });

  it('moves a scan to unavailable instead of polling forever when the provider is absent', async () => {
    const target = await createNoteAndReceipt('scan-unavailable');
    setReceiptProcessingTestProvider(null);
    await processPendingReceiptJobs({ maxJobs: 1, receiptId: target.receiptId });
    const [stored] = await db.select().from(receipts).where(eq(receipts.id, target.receiptId));
    expect(stored.scanStatus).toBe('unavailable');
    const status = await request(app)
      .get(`/v1/receipts/${target.receiptId}/ocr`)
      .set('Authorization', `Bearer ${token}`);
    expect(status.body).toMatchObject({ status: 'unavailable', reason: 'SECURITY_SCAN_UNAVAILABLE' });
  });

  it('rechecks OCR consent in the worker and persists no text after revocation', async () => {
    const target = await createNoteAndReceipt('revoked-consent');
    let ocrCalls = 0;
    setReceiptProcessingTestProvider(provider({
      extractText: async () => {
        ocrCalls++;
        return { text: 'must not persist', providerReference: null };
      },
    }));
    await processPendingReceiptJobs({ maxJobs: 1, receiptId: target.receiptId });
    const [receipt] = await db.select().from(receipts).where(eq(receipts.id, target.receiptId));
    await db.update(privacyPreferences).set({ aiProcessingAllowed: true, thirdPartyAiAllowed: true })
      .where(eq(privacyPreferences.userId, receipt.userId));
    const requested = await request(app)
      .post(`/v1/receipts/${target.receiptId}/ocr`)
      .set('Authorization', `Bearer ${token}`);
    expect(requested.status).toBe(202);
    await db.update(privacyPreferences).set({ aiProcessingAllowed: false, thirdPartyAiAllowed: false })
      .where(eq(privacyPreferences.userId, receipt.userId));
    await processPendingReceiptJobs({ maxJobs: 1, receiptId: target.receiptId });
    expect(ocrCalls).toBe(0);
    const status = await request(app).get(`/v1/receipts/${target.receiptId}/ocr`).set('Authorization', `Bearer ${token}`);
    expect(status.body).toMatchObject({ status: 'unavailable', reason: 'OCR_CONSENT_REVOKED' });
    expect(await db.select().from(ocrTexts).where(eq(ocrTexts.receiptId, target.receiptId))).toHaveLength(0);
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

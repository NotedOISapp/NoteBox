import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { reauthenticateUser, generateMockAppleToken } from '../utils/appleTestAuth.js';


describe('BOLA / Ownership Security Tests (SEC-020)', () => {
  let tokenA: string;
  let tokenB: string;

  let boxBId: string;
  let noteBId: string;
  let personBId: string;
  let receiptBId: string;

  beforeAll(async () => {
    // 1. Create User A
    const appleIdA = 'bola_user_a';
    const identityTokenA = generateMockAppleToken({ sub: appleIdA });
    const resAuthA = await request(app)
      .post('/v1/auth/apple')
      .send({ identityToken: identityTokenA, appleId: appleIdA, displayName: 'User A' });
    expect(resAuthA.status).toBe(200);
    tokenA = resAuthA.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ attestAdult: true });

    // 2. Create User B
    const appleIdB = 'bola_user_b';
    const identityTokenB = generateMockAppleToken({ sub: appleIdB });
    const resAuthB = await request(app)
      .post('/v1/auth/apple')
      .send({ identityToken: identityTokenB, appleId: appleIdB, displayName: 'User B' });
    expect(resAuthB.status).toBe(200);
    tokenB = resAuthB.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ attestAdult: true });

    // 3. User B creates a Box
    const resBoxB = await request(app)
      .post('/v1/boxes')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'User B Secret Box' });
    expect(resBoxB.status).toBe(201);
    boxBId = resBoxB.body.id;

    // 4. User B creates a Note
    const resNoteB = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ boxId: boxBId, body: 'User B confidential note text for BOLA' });
    expect(resNoteB.status).toBe(201);
    noteBId = resNoteB.body.id;

    // 5. User B creates a Person
    const resPersonB = await request(app)
      .post('/v1/people')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'User B Friend', relationship: 'Friend' });
    expect(resPersonB.status).toBe(201);
    personBId = resPersonB.body.id;

    // 6. User B confirms a Receipt
    const uploadUrlRes = await request(app)
      .post('/v1/receipts/upload-url')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        noteId: noteBId,
        contentType: 'image/png',
        sizeBytes: 1024,
      });
    expect(uploadUrlRes.status).toBe(201);

    const uploadRes = await request(app)
      .put(uploadUrlRes.body.uploadUrl)
      .set('Authorization', `Bearer ${tokenB}`)
      .set('Content-Type', 'image/png')
      .send(Buffer.alloc(1024, 1));
    expect(uploadRes.status).toBe(201);

    const resReceiptB = await request(app)
      .post('/v1/receipts/confirm')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        reservationId: uploadUrlRes.body.reservationId,
      });
    expect(resReceiptB.status).toBe(201);
    receiptBId = resReceiptB.body.receipt.id;
  });

  it('User A cannot update or delete User B’s Box', async () => {
    const patchRes = await request(app)
      .patch(`/v1/boxes/${boxBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Hacked Box Name' });
    expect(patchRes.status).toBe(404);

    const delRes = await request(app)
      .delete(`/v1/boxes/${boxBId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(delRes.status).toBe(404);
  });

  it('User A cannot access User B’s Note by ID', async () => {
    const getRes = await request(app)
      .get(`/v1/notes/${noteBId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(getRes.status).toBe(404);
  });

  it('User A cannot create notes inside User B’s Box', async () => {
    const postRes = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ boxId: boxBId, body: 'Malicious note in B box' });
    expect(postRes.status).toBe(404);
  });

  it('User A cannot attach receipts or generate upload URLs for User B’s Note', async () => {
    const uploadUrlRes = await request(app)
      .post('/v1/receipts/upload-url')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ contentType: 'image/png', sizeBytes: 500, noteId: noteBId });
    expect(uploadUrlRes.status).toBe(404);

    const confirmRes = await request(app)
      .post('/v1/receipts/confirm')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        noteId: noteBId,
        reservationId: '00000000-0000-0000-0000-000000000000',
        storageKey: 'receipts/userA/malicious.png',
        contentType: 'image/png',
        sizeBytes: 500,
        sha256: 'b'.repeat(64),
      });
    expect(confirmRes.status).toBe(400);
  });

  it('User A cannot trigger AI Perspectives on User B’s Note', async () => {
    const perspRes = await request(app)
      .post(`/v1/notes/${noteBId}/perspectives`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ intensity: 'bold' });
    expect(perspRes.status).toBe(404);
  });

  it('User A cannot view AI Perspectives of User B’s Note', async () => {
    const getPerspRes = await request(app)
      .get(`/v1/notes/${noteBId}/perspectives`)
      .set('Authorization', `Bearer ${tokenA}`);
    // Should return empty array or only User A's records (which is empty)
    expect(getPerspRes.status).toBe(200);
    expect(Array.isArray(getPerspRes.body.perspectives)).toBe(true);
    expect(getPerspRes.body.perspectives.length).toBe(0);
  });

  it('User A cannot update User B’s People entries', async () => {
    const patchRes = await request(app)
      .patch(`/v1/people/${personBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Hacked Person Name' });
    expect(patchRes.status).toBe(404);
  });

  it('User A cannot find User B’s content via search', async () => {
    const searchRes = await request(app)
      .get('/v1/search?q=confidential')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.results.length).toBe(0);
  });

  it('User A data export does not leak User B’s notes or boxes', async () => {
    await reauthenticateUser(app, tokenA, 'bola_user_a');

    const exportReqRes = await request(app)
      .post('/v1/privacy/export-request')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ format: 'zip' });
    expect(exportReqRes.status).toBe(202);
    const ticketId = exportReqRes.body.ticketId;
    expect(ticketId).toBeDefined();

    const { processPendingExports } = await import('../cron.js');
    await processPendingExports();

    const downloadRes = await request(app)
      .get(`/v1/privacy/export-request/${ticketId}/download`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.header['content-type']).toBe('application/zip');

    const zipString = downloadRes.body.toString('binary');
    expect(zipString).not.toContain('User B confidential note text for BOLA');
    expect(zipString).not.toContain('User B Secret Box');
  });
});

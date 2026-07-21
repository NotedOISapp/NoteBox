import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';
import { db } from '../db/index.js';
import { idempotencyRecords } from '../db/schema.js';
import { eq } from 'drizzle-orm';

describe('Notes Route Tests', () => {
  let token: string;
  let boxId: string;
  let noteId: string;

  beforeAll(async () => {
    const resAuth = await request(app)
      .post('/v1/auth/apple')
      .send({ appleId: 'notes_test_user', displayName: 'Notes Test User' });
    token = resAuth.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ attestAdult: true });

    const resBox = await request(app)
      .post('/v1/boxes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Notes Box' });
    boxId = resBox.body.id;
  });

  it('lists notes initially empty', async () => {
    const res = await request(app)
      .get('/v1/notes')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('creates a new note', async () => {
    const res = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ boxId, body: 'This is a secret note body for test' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.body).toBe('This is a secret note body for test');
    noteId = res.body.id;
  });

  it('persists idempotent create responses without duplicating the Note', async () => {
    const clientMutationId = `note-create-${Date.now()}`;
    const first = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ boxId, body: 'Durable retry body', clientMutationId });
    const retry = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ boxId, body: 'A retry must not overwrite the first request', clientMutationId });

    expect(first.status).toBe(201);
    expect(retry.status).toBe(201);
    expect(retry.body).toEqual(first.body);

    const storedResponses = await db
      .select()
      .from(idempotencyRecords)
      .where(eq(idempotencyRecords.clientMutationId, clientMutationId));
    expect(storedResponses).toHaveLength(1);
    expect(storedResponses[0].responseBodyCiphertext).not.toContain('Durable retry body');

    const differentOperation = await request(app)
      .post('/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Operation Scoped Person', clientMutationId });
    expect(differentOperation.status).toBe(201);
    expect(differentOperation.body.name).toBe('Operation Scoped Person');

    const list = await request(app)
      .get('/v1/notes')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.filter((note: any) => note.id === first.body.id)).toHaveLength(1);
  });

  it('scopes an idempotency key by user so another user never receives the first user response', async () => {
    const auth = await request(app)
      .post('/v1/auth/apple')
      .send({ appleId: `notes_second_user_${Date.now()}`, displayName: 'Second Notes User' });
    const secondToken = auth.body.accessToken;
    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${secondToken}`)
      .send({ attestAdult: true });
    const secondBox = await request(app)
      .post('/v1/boxes')
      .set('Authorization', `Bearer ${secondToken}`)
      .send({ name: 'Second User Box' });

    const sharedMutationId = `shared-${Date.now()}`;
    const firstUser = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ boxId, body: 'First user private body', clientMutationId: sharedMutationId });
    const secondUser = await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${secondToken}`)
      .send({ boxId: secondBox.body.id, body: 'Second user private body', clientMutationId: sharedMutationId });

    expect(firstUser.status).toBe(201);
    expect(secondUser.status).toBe(201);
    expect(secondUser.body.id).not.toBe(firstUser.body.id);
    expect(secondUser.body.body).toBe('Second user private body');
  });

  it('retrieves note by ID', async () => {
    const res = await request(app)
      .get(`/v1/notes/${noteId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(noteId);
  });

  it('adds more content to note', async () => {
    const res = await request(app)
      .post(`/v1/notes/${noteId}/add-more`)
      .set('Authorization', `Bearer ${token}`)
      .send({ body: 'Additional note thought' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.body).toBe('Additional note thought');
  });

  it('lists Add-more blocks canonically for restoration', async () => {
    const res = await request(app)
      .get(`/v1/notes/${noteId}/add-more`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ noteId, body: 'Additional note thought' }),
    ]));
  });

  it('deletes note via DELETE', async () => {
    const res = await request(app)
      .delete(`/v1/notes/${noteId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const getRes = await request(app)
      .get(`/v1/notes/${noteId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(404);
  });
});

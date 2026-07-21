import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('Boxes Route Tests', () => {
  let token: string;
  let boxId: string;

  beforeAll(async () => {
    const resAuth = await request(app)
      .post('/v1/auth/apple')
      .send({ appleId: 'boxes_test_user', displayName: 'Boxes Test User' });
    token = resAuth.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ attestAdult: true });
  });

  it('lists boxes initially empty or default', async () => {
    const res = await request(app)
      .get('/v1/boxes')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('creates a new box', async () => {
    const res = await request(app)
      .post('/v1/boxes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Work Box' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Work Box');
    boxId = res.body.id;
  });

  it('rejects creating a box with empty name', async () => {
    const res = await request(app)
      .post('/v1/boxes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('updates box name via PATCH', async () => {
    const res = await request(app)
      .patch(`/v1/boxes/${boxId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Updated Work Box' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Work Box');
  });

  it('deletes box via DELETE', async () => {
    const res = await request(app)
      .delete(`/v1/boxes/${boxId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    // Verify it is no longer listed or marked archived/deleted
    const listRes = await request(app)
      .get('/v1/boxes')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    const ids = listRes.body.map((b: any) => b.id);
    expect(ids).not.toContain(boxId);
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('People Route Tests', () => {
  let token: string;
  let personId: string;

  beforeAll(async () => {
    const resAuth = await request(app)
      .post('/v1/auth/apple')
      .send({ appleId: 'people_test_user', displayName: 'People Test User' });
    token = resAuth.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ attestAdult: true });
  });

  it('lists people initially empty', async () => {
    const res = await request(app)
      .get('/v1/people')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('creates a person', async () => {
    const res = await request(app)
      .post('/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice Smith', relationship: 'Colleague' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('Alice Smith');
    personId = res.body.id;
  });

  it('rejects creating a person with missing name', async () => {
    const res = await request(app)
      .post('/v1/people')
      .set('Authorization', `Bearer ${token}`)
      .send({ relationship: 'Friend' });
    expect(res.status).toBe(400);
  });

  it('updates person name via PATCH', async () => {
    const res = await request(app)
      .patch(`/v1/people/${personId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Alice Jones' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Alice Jones');
  });

  it('deletes person via DELETE', async () => {
    const res = await request(app)
      .delete(`/v1/people/${personId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const listRes = await request(app)
      .get('/v1/people')
      .set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    const ids = listRes.body.map((p: any) => p.id);
    expect(ids).not.toContain(personId);
  });
});

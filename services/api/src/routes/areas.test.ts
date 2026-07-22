import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('Areas / Categories Route Tests', () => {
  let tokenA: string;
  let tokenB: string;
  let categoryIdA: string;

  beforeAll(async () => {
    const resA = await request(app)
      .post('/v1/auth/apple')
      .send({ appleId: 'areas_user_a', displayName: 'Areas User A' });
    tokenA = resA.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ attestAdult: true });

    const resB = await request(app)
      .post('/v1/auth/apple')
      .send({ appleId: 'areas_user_b', displayName: 'Areas User B' });
    tokenB = resB.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ attestAdult: true });
  });

  it('GET /v1/areas seeds default categories if empty', async () => {
    const res = await request(app)
      .get('/v1/areas')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(4); // Personal, Work, Family, Other
    const names = res.body.map((c: any) => c.name);
    expect(names).toContain('Personal');
    expect(names).toContain('Work');

    categoryIdA = res.body[0].id;
  });

  it('GET /v1/areas returns existing categories without re-seeding', async () => {
    const res = await request(app)
      .get('/v1/areas')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(4);
  });

  it('POST /v1/areas rejects empty name', async () => {
    const res = await request(app)
      .post('/v1/areas')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: ' ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('POST /v1/areas creates custom category', async () => {
    const res = await request(app)
      .post('/v1/areas')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Custom Life' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Custom Life');
    expect(res.body.userId).toBeDefined();
  });

  it('PATCH /v1/areas/:id rejects empty name', async () => {
    const res = await request(app)
      .patch(`/v1/areas/${categoryIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('PATCH /v1/areas/:id rejects other user category update', async () => {
    const res = await request(app)
      .patch(`/v1/areas/${categoryIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hacked Area' });
    expect(res.status).toBe(404);
  });

  it('PATCH /v1/areas/:id renames category', async () => {
    const res = await request(app)
      .patch(`/v1/areas/${categoryIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Renamed Personal' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed Personal');
  });

  it('DELETE /v1/areas/:id rejects other user category deletion', async () => {
    const res = await request(app)
      .delete(`/v1/areas/${categoryIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it('DELETE /v1/areas/:id deletes category successfully', async () => {
    const res = await request(app)
      .delete(`/v1/areas/${categoryIdA}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

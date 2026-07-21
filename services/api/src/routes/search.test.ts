import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../index.js';

describe('Search Route Tests', () => {
  let token: string;
  let boxId: string;

  beforeAll(async () => {
    const resAuth = await request(app)
      .post('/v1/auth/apple')
      .send({ appleId: 'search_test_user', displayName: 'Search Test User' });
    token = resAuth.body.accessToken;

    await request(app)
      .post('/v1/auth/eligibility')
      .set('Authorization', `Bearer ${token}`)
      .send({ attestAdult: true });

    const resBox = await request(app)
      .post('/v1/boxes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Searchable Box' });
    boxId = resBox.body.id;

    await request(app)
      .post('/v1/notes')
      .set('Authorization', `Bearer ${token}`)
      .send({ boxId, body: 'The quick brown fox jumps over the lazy dog' });
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
});

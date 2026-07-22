import { describe, it, expect } from 'vitest';
import request from 'supertest';
import pg from 'pg';
import net from 'net';


const pingRedis = (host: string, port: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.connect(port, host, () => {
      socket.write('*1\r\n$4\r\nPING\r\n');
    });
    socket.on('data', (data) => {
      resolve(data.toString().trim());
      socket.destroy();
    });
    socket.on('error', (err) => {
      reject(err);
    });
    socket.on('timeout', () => {
      reject(new Error('Redis ping timeout'));
      socket.destroy();
    });
  });
};

describe('Test Harness Container Validation', () => {
  it('should successfully query the Postgres test container', async () => {
    const connectionString = process.env.DATABASE_URL;
    expect(connectionString).toBeDefined();
    expect(connectionString).toMatch(/^postgres(?:ql)?:\/\//);
    const pool = new pg.Pool({ connectionString });
    const result = await pool.query('SELECT 1 as val');
    expect(result.rows[0].val).toBe(1);
    await pool.end();
  });

  it('should successfully run a query via Drizzle ORM against the test container', async () => {
    const { db } = await import('../src/db/index.js');
    const { users } = await import('../src/db/schema.js');
    const allUsers = await db.select().from(users);
    expect(Array.isArray(allUsers)).toBe(true);
  });

  it('should successfully ping the Redis test container', async () => {
    const redisUrl = process.env.REDIS_URL;
    expect(redisUrl).toBeDefined();
    const url = new URL(redisUrl!);
    const pingResult = await pingRedis(url.hostname, Number.parseInt(url.port, 10));
    expect(pingResult).toContain('PONG');
  });

  it('should respond with healthy status from /health API endpoint', async () => {
    const { app } = await import('../src/index.js');
    const response = await request(app).get('/health').expect(200);
    expect(response.body.status).toBe('healthy');
    expect(response.body).toHaveProperty('timestamp');
  });
});

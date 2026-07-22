import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const statePath = path.join(dirname, '.integration-state.json');

export default async function globalSetup(): Promise<() => Promise<void>> {
  let postgresContainer: StartedPostgreSqlContainer | undefined;
  let redisContainer: StartedRedisContainer | undefined;

  try {
    postgresContainer = await new PostgreSqlContainer('postgres:16-alpine')
      .withDatabase('notebox_test')
      .withUsername('notebox')
      .withPassword('password')
      .start();

    redisContainer = await new RedisContainer('redis:7-alpine').start();
  } catch (error) {
    throw new Error(
      `Integration infrastructure failed to start. PostgreSQL and Redis Testcontainers are required. ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const databaseUrl = postgresContainer.getConnectionUri();
  const redisUrl = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
  const environment = {
    NODE_ENV: 'test',
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    JWT_ACCESS_SECRET: 'test-jwt-access-secret-at-least-32-chars',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-at-least-32-chars',
    AGE_GATE_SECRET: 'test-age-gate-secret-at-least-32-chars',
    FIELD_ENCRYPTION_KEY: '0000000000000000000000000000000000000000000000000000000000000000',
    CORS_ORIGIN: 'http://localhost:3000',
    RATE_LIMIT_WINDOW_MS: '900000',
    RATE_LIMIT_MAX_REQUESTS: '100000',
    APPLE_BUNDLE_ID: 'com.notebox.app',
    APPLE_APP_ID: '1234567890',
    APPLE_STOREKIT_ENVIRONMENT: 'Sandbox',
    APPLE_STOREKIT_ENABLE_ONLINE_CHECKS: 'false',
  };

  Object.assign(process.env, environment);
  fs.writeFileSync(statePath, JSON.stringify(environment), 'utf8');

  const pool = new pg.Pool({ connectionString: databaseUrl });
  try {
    await migrate(drizzle(pool), { migrationsFolder: path.resolve(dirname, '../drizzle') });
    await pool.query(`
      UPDATE founding_campaign_configs
      SET is_active = true,
          signup_starts_at = '2025-01-01 00:00:00',
          signup_ends_at = '2028-12-31 23:59:59',
          redemption_starts_at = '2025-01-01 00:00:00',
          redemption_ends_at = '2028-12-31 23:59:59',
          requires_extension_invite = false,
          requires_founding_feedback = false,
          updated_at = now()
    `);
  } finally {
    await pool.end();
  }

  return async () => {
    try { fs.rmSync(statePath, { force: true }); } catch { /* noop */ }
    await Promise.allSettled([
      postgresContainer?.stop(),
      redisContainer?.stop(),
    ]);
  };
}

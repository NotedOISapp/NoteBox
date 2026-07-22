import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { DATABASE_URL } from '../config/env.js';
import { AsyncLocalStorage } from 'async_hooks';


export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
});

// Storage context for connection-scoped RLS client
export const rlsStorage = new AsyncLocalStorage<any>();

const rawDb = drizzle(pool, { schema });

// ES6 Proxy wrapping the database client to enforce context isolation
export const db = new Proxy(rawDb, {
  get(target, prop, receiver) {
    const store = rlsStorage.getStore();
    const activeDb = store ? store : target;
    const value = Reflect.get(activeDb, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(activeDb);
    }
    return value;
  },
}) as typeof rawDb;

export { schema };
export type DBType = typeof db;

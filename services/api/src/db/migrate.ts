import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './index';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrations completed!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});

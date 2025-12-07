import { db } from '../db/client';
import { sql } from 'drizzle-orm';

const migrations = [
  `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "visible_to_client" boolean DEFAULT false`,
  `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "is_blocking" boolean DEFAULT false`,
];

async function run() {
  console.log('Adding client-visible task columns to tasks table...');

  for (const statement of migrations) {
    try {
      console.log(`Executing: ${statement}`);
      await db.execute(sql.raw(statement));
      console.log('  ✓ Success');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('already exists')) {
        console.log('  ⚠ Column already exists, skipping');
      } else {
        console.error('  ✗ Error:', message);
        throw error;
      }
    }
  }

  console.log('Done.');
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Migration failed:', message);
    process.exit(1);
  });

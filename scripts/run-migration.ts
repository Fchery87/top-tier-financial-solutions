/**
 * Run the bureau fields migration directly
 */
import { db } from '../db/client';
import { sql } from 'drizzle-orm';

const migrations = [
  `ALTER TABLE "credit_accounts" ADD COLUMN IF NOT EXISTS "on_transunion" boolean DEFAULT false`,
  `ALTER TABLE "credit_accounts" ADD COLUMN IF NOT EXISTS "on_experian" boolean DEFAULT false`,
  `ALTER TABLE "credit_accounts" ADD COLUMN IF NOT EXISTS "on_equifax" boolean DEFAULT false`,
  `ALTER TABLE "credit_accounts" ADD COLUMN IF NOT EXISTS "transunion_date" timestamp`,
  `ALTER TABLE "credit_accounts" ADD COLUMN IF NOT EXISTS "experian_date" timestamp`,
  `ALTER TABLE "credit_accounts" ADD COLUMN IF NOT EXISTS "equifax_date" timestamp`,
  `ALTER TABLE "credit_accounts" ADD COLUMN IF NOT EXISTS "transunion_balance" integer`,
  `ALTER TABLE "credit_accounts" ADD COLUMN IF NOT EXISTS "experian_balance" integer`,
  `ALTER TABLE "credit_accounts" ADD COLUMN IF NOT EXISTS "equifax_balance" integer`,
  `ALTER TABLE "negative_items" ADD COLUMN IF NOT EXISTS "on_transunion" boolean DEFAULT false`,
  `ALTER TABLE "negative_items" ADD COLUMN IF NOT EXISTS "on_experian" boolean DEFAULT false`,
  `ALTER TABLE "negative_items" ADD COLUMN IF NOT EXISTS "on_equifax" boolean DEFAULT false`,
  `ALTER TABLE "negative_items" ADD COLUMN IF NOT EXISTS "transunion_date" timestamp`,
  `ALTER TABLE "negative_items" ADD COLUMN IF NOT EXISTS "experian_date" timestamp`,
  `ALTER TABLE "negative_items" ADD COLUMN IF NOT EXISTS "equifax_date" timestamp`,
  `ALTER TABLE "negative_items" ADD COLUMN IF NOT EXISTS "transunion_status" text`,
  `ALTER TABLE "negative_items" ADD COLUMN IF NOT EXISTS "experian_status" text`,
  `ALTER TABLE "negative_items" ADD COLUMN IF NOT EXISTS "equifax_status" text`,
];

async function runMigration() {
  console.log('Running bureau fields migration...\n');

  for (const migration of migrations) {
    try {
      console.log(`Executing: ${migration.substring(0, 60)}...`);
      await db.execute(sql.raw(migration));
      console.log('  ✓ Success\n');
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log('  ⚠ Column already exists, skipping\n');
      } else {
        console.error('  ✗ Error:', error.message);
      }
    }
  }

  console.log('Migration complete!');
}

runMigration()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });

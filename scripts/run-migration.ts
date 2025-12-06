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
  // Disputes table - escalation and evidence columns
  `ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "escalation_ready_at" timestamp`,
  `ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "evidence_document_ids" text`,
];

async function runMigration() {
  console.log('Running bureau fields migration...\n');

  for (const migration of migrations) {
    try {
      console.log(`Executing: ${migration.substring(0, 60)}...`);
      await db.execute(sql.raw(migration));
      console.log('  ✓ Success\n');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('already exists')) {
        console.log('  ⚠ Column already exists, skipping\n');
      } else {
        console.error('  ✗ Error:', message);
      }
    }
  }

  console.log('Migration complete!');
}

runMigration()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Migration failed:', message);
    process.exit(1);
  });

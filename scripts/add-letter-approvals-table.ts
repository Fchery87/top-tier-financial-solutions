import { db } from '../db/client';
import { sql } from 'drizzle-orm';

const migrations = [
  `CREATE TABLE IF NOT EXISTS "letter_approvals" (
    "id" text PRIMARY KEY,
    "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
    "dispute_id" text REFERENCES "disputes"("id") ON DELETE CASCADE,
    "batch_id" text REFERENCES "dispute_batches"("id") ON DELETE SET NULL,
    "round" integer,
    "status" text DEFAULT 'pending',
    "approval_method" text,
    "signature_text" text,
    "signature_ip" text,
    "signature_user_agent" text,
    "approved_at" timestamp,
    "rejected_at" timestamp,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "letter_approvals_clientId_idx" ON "letter_approvals" ("client_id")`,
  `CREATE INDEX IF NOT EXISTS "letter_approvals_disputeId_idx" ON "letter_approvals" ("dispute_id")`,
  `CREATE INDEX IF NOT EXISTS "letter_approvals_batchId_idx" ON "letter_approvals" ("batch_id")`,
];

async function run() {
  console.log('Ensuring letter_approvals table exists...');

  for (const statement of migrations) {
    try {
      console.log(`Executing: ${statement.split('\n')[0]}...`);
      await db.execute(sql.raw(statement));
      console.log('  ✓ Success');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // If table or index already exists, continue
      if (message.includes('already exists')) {
        console.log('  ✓ Already exists, skipping');
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

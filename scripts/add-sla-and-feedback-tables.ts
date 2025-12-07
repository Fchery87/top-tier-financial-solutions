import { db } from '../db/client';
import { sql } from 'drizzle-orm';

const migrations = [
  `CREATE TABLE IF NOT EXISTS "sla_definitions" (
    "id" text PRIMARY KEY,
    "name" text NOT NULL,
    "description" text,
    "stage" text NOT NULL,
    "max_days" integer NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "sla_definitions_stage_idx" ON "sla_definitions" ("stage")`,
  `CREATE INDEX IF NOT EXISTS "sla_definitions_isActive_idx" ON "sla_definitions" ("is_active")`,
  `CREATE TABLE IF NOT EXISTS "sla_instances" (
    "id" text PRIMARY KEY,
    "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
    "definition_id" text NOT NULL REFERENCES "sla_definitions"("id") ON DELETE CASCADE,
    "stage" text,
    "started_at" timestamp DEFAULT now(),
    "due_at" timestamp,
    "completed_at" timestamp,
    "status" text DEFAULT 'active',
    "breach_notified_at" timestamp,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "sla_instances_clientId_idx" ON "sla_instances" ("client_id")`,
  `CREATE INDEX IF NOT EXISTS "sla_instances_definitionId_idx" ON "sla_instances" ("definition_id")`,
  `CREATE INDEX IF NOT EXISTS "sla_instances_status_idx" ON "sla_instances" ("status")`,
  `CREATE TABLE IF NOT EXISTS "client_feedback" (
    "id" text PRIMARY KEY,
    "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
    "context" text NOT NULL,
    "rating" integer,
    "comment" text,
    "created_at" timestamp DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "client_feedback_clientId_idx" ON "client_feedback" ("client_id")`,
  `CREATE INDEX IF NOT EXISTS "client_feedback_context_idx" ON "client_feedback" ("context")`,
];

async function run() {
  console.log('Ensuring SLA and client_feedback tables exist...');

  for (const statement of migrations) {
    try {
      console.log(`Executing: ${statement.split('\n')[0]}...`);
      await db.execute(sql.raw(statement));
      console.log('  ✓ Success');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
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

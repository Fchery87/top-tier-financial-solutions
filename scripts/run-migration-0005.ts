import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function runMigration() {
  console.log('Running migration 0005...');
  
  try {
    // Create dispute_batches table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS "dispute_batches" (
        "id" text PRIMARY KEY NOT NULL,
        "client_id" text NOT NULL,
        "round" integer DEFAULT 1,
        "target_recipient" text DEFAULT 'bureau',
        "items_count" integer DEFAULT 0,
        "letters_generated" integer DEFAULT 0,
        "status" text DEFAULT 'draft',
        "generation_method" text DEFAULT 'ai',
        "sent_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `;
    console.log('  Created dispute_batches table');

    // Add foreign key constraint
    try {
      await sql`
        ALTER TABLE "dispute_batches" 
        ADD CONSTRAINT "dispute_batches_client_id_clients_id_fk" 
        FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action
      `;
    } catch {
      console.log('  FK constraint already exists or error');
    }

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS "dispute_batches_clientId_idx" ON "dispute_batches" USING btree ("client_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "dispute_batches_status_idx" ON "dispute_batches" USING btree ("status")`;
    console.log('  Created indexes for dispute_batches');

    // Add new columns to disputes table if they don't exist
    try {
      await sql`ALTER TABLE "disputes" ADD COLUMN "batch_id" text`;
      console.log('  Added column batch_id');
    } catch { console.log('  Column batch_id already exists'); }

    try {
      await sql`ALTER TABLE "disputes" ADD COLUMN "reason_codes" text`;
      console.log('  Added column reason_codes');
    } catch { console.log('  Column reason_codes already exists'); }

    try {
      await sql`ALTER TABLE "disputes" ADD COLUMN "escalation_path" text`;
      console.log('  Added column escalation_path');
    } catch { console.log('  Column escalation_path already exists'); }

    try {
      await sql`ALTER TABLE "disputes" ADD COLUMN "generated_by_ai" boolean DEFAULT false`;
      console.log('  Added column generated_by_ai');
    } catch { console.log('  Column generated_by_ai already exists'); }

    // Add FK for batch_id
    try {
      await sql`
        ALTER TABLE "disputes" 
        ADD CONSTRAINT "disputes_batch_id_dispute_batches_id_fk" 
        FOREIGN KEY ("batch_id") REFERENCES "public"."dispute_batches"("id") ON DELETE set null ON UPDATE no action
      `;
    } catch {
      console.log('  FK constraint for batch_id already exists or error');
    }

    // Create index for batch_id
    await sql`CREATE INDEX IF NOT EXISTS "disputes_batchId_idx" ON "disputes" USING btree ("batch_id")`;
    console.log('  Created index for disputes.batch_id');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

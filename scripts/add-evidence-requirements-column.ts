import { db } from '../db/client';
import { sql } from 'drizzle-orm';

async function run() {
  console.log('Adding evidence_requirements column to dispute_letter_templates...');
  
  try {
    await db.execute(sql.raw(`
      ALTER TABLE "dispute_letter_templates" 
      ADD COLUMN IF NOT EXISTS "evidence_requirements" text
    `));
    console.log('✓ Column added successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('✗ Migration failed:', message);
    throw error;
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Migration failed:', message);
    process.exit(1);
  });

import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

console.log('Connecting to database...');
const sql = neon(process.env.DATABASE_URL);

console.log('Creating llm_provider enum type...');
try {
  await sql`CREATE TYPE "public"."llm_provider" AS ENUM('google', 'openai', 'anthropic', 'custom')`;
  console.log('✓ llm_provider enum created');
} catch (error) {
  if (error.message.includes('already exists')) {
    console.log('✓ llm_provider enum already exists');
  } else {
    console.error('Error creating enum:', error);
    process.exit(1);
  }
}

console.log('Creating system_settings table...');
try {
  await sql`
    CREATE TABLE IF NOT EXISTS "system_settings" (
      "id" text PRIMARY KEY NOT NULL,
      "setting_key" text NOT NULL,
      "setting_value" text,
      "setting_type" text NOT NULL,
      "category" text DEFAULT 'general',
      "description" text,
      "is_secret" boolean DEFAULT false,
      "last_modified_by" text,
      "created_at" timestamp DEFAULT now(),
      "updated_at" timestamp DEFAULT now(),
      CONSTRAINT "system_settings_setting_key_unique" UNIQUE("setting_key")
    )
  `;
  console.log('✓ system_settings table created');

  try {
    await sql`
      ALTER TABLE "system_settings" 
      ADD CONSTRAINT "system_settings_last_modified_by_user_id_fk" 
      FOREIGN KEY ("last_modified_by") REFERENCES "public"."user"("id") 
      ON DELETE set null ON UPDATE no action
    `;
    console.log('✓ Foreign key constraint added');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('✓ Foreign key constraint already exists');
    } else {
      throw error;
    }
  }

  await sql`CREATE INDEX IF NOT EXISTS "system_settings_key_idx" ON "system_settings" USING btree ("setting_key")`;
  console.log('✓ Index on setting_key created');

  await sql`CREATE INDEX IF NOT EXISTS "system_settings_category_idx" ON "system_settings" USING btree ("category")`;
  console.log('✓ Index on category created');

  console.log('\n✅ Migration completed successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}

process.exit(0);

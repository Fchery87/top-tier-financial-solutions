/**
 * Direct migration push script
 * Run with: npx tsx scripts/push-migration.ts
 */

import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function pushMigration() {
  console.log('Pushing CRM dashboard schema changes to database...\n');

  try {
    // Check if client_stage enum already exists
    const enumExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'client_stage'
      )
    `;
    
    if (!enumExists[0].exists) {
      console.log('Creating client_stage enum...');
      await sql`CREATE TYPE "public"."client_stage" AS ENUM('lead', 'consultation', 'agreement', 'onboarding', 'active', 'completed')`;
      console.log('✓ Created client_stage enum');
    } else {
      console.log('⏭ client_stage enum already exists, skipping...');
    }

    // Check if goal_type enum already exists
    const goalEnumExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'goal_type'
      )
    `;
    
    if (!goalEnumExists[0].exists) {
      console.log('Creating goal_type enum...');
      await sql`CREATE TYPE "public"."goal_type" AS ENUM('deletions', 'new_clients', 'disputes_sent', 'revenue')`;
      console.log('✓ Created goal_type enum');
    } else {
      console.log('⏭ goal_type enum already exists, skipping...');
    }

    // Check if goals table exists
    const goalsTableExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'goals'
      )
    `;
    
    if (!goalsTableExists[0].exists) {
      console.log('Creating goals table...');
      await sql`
        CREATE TABLE "goals" (
          "id" text PRIMARY KEY NOT NULL,
          "user_id" text,
          "month" text NOT NULL,
          "goal_type" "goal_type" NOT NULL,
          "target" integer NOT NULL,
          "current" integer DEFAULT 0,
          "created_at" timestamp DEFAULT now(),
          "updated_at" timestamp DEFAULT now()
        )
      `;
      await sql`ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action`;
      await sql`CREATE INDEX IF NOT EXISTS "goals_userId_idx" ON "goals" USING btree ("user_id")`;
      await sql`CREATE INDEX IF NOT EXISTS "goals_month_idx" ON "goals" USING btree ("month")`;
      console.log('✓ Created goals table with indexes');
    } else {
      console.log('⏭ goals table already exists, skipping...');
    }

    // Check if stage column exists on clients table
    const stageColumnExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clients' AND column_name = 'stage'
      )
    `;
    
    if (!stageColumnExists[0].exists) {
      console.log('Adding stage column to clients table...');
      await sql`ALTER TABLE "clients" ADD COLUMN "stage" "client_stage" DEFAULT 'lead'`;
      await sql`CREATE INDEX IF NOT EXISTS "clients_stage_idx" ON "clients" USING btree ("stage")`;
      console.log('✓ Added stage column with index');
    } else {
      console.log('⏭ stage column already exists, skipping...');
    }

    // Check if assigned_to column exists on clients table
    const assignedToColumnExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clients' AND column_name = 'assigned_to'
      )
    `;
    
    if (!assignedToColumnExists[0].exists) {
      console.log('Adding assigned_to column to clients table...');
      await sql`ALTER TABLE "clients" ADD COLUMN "assigned_to" text`;
      await sql`ALTER TABLE "clients" ADD CONSTRAINT "clients_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action`;
      await sql`CREATE INDEX IF NOT EXISTS "clients_assignedTo_idx" ON "clients" USING btree ("assigned_to")`;
      console.log('✓ Added assigned_to column with index');
    } else {
      console.log('⏭ assigned_to column already exists, skipping...');
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

pushMigration();

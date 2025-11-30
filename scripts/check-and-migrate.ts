import { db } from '../db/client';
import { sql } from 'drizzle-orm';

async function checkAndMigrate() {
  console.log('Checking existing tables...');
  
  // Check which tables exist
  const tablesResult = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  
  const existingTables = tablesResult.rows.map((r) => (r as { table_name: string }).table_name);
  console.log('Existing tables:', existingTables);
  
  // Check consultation_requests.id type
  const colTypeResult = await db.execute(sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'consultation_requests' AND column_name = 'id'
  `);
  console.log('consultation_requests.id type:', colTypeResult.rows);
  
  const requiredTables = [
    'clients',
    'credit_reports',
    'credit_accounts',
    'negative_items',
    'credit_analyses',
    'disputes',
    'dispute_letter_templates'
  ];
  
  const missingTables = requiredTables.filter(t => !existingTables.includes(t));
  console.log('Missing tables:', missingTables);
  
  if (missingTables.length === 0) {
    console.log('All required tables exist!');
    return;
  }
  
  console.log('Creating missing tables...');
  
  // Create tables in order (respecting foreign key dependencies)
  // Note: lead_id references consultation_requests which has uuid type, so we need to match
  if (missingTables.includes('clients')) {
    console.log('Creating clients table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "clients" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
        "lead_id" uuid REFERENCES "consultation_requests"("id") ON DELETE SET NULL,
        "first_name" text NOT NULL,
        "last_name" text NOT NULL,
        "email" text NOT NULL,
        "phone" text,
        "status" text DEFAULT 'active',
        "notes" text,
        "converted_at" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "clients_userId_idx" ON "clients" ("user_id")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "clients_email_idx" ON "clients" ("email")`);
    console.log('  Created clients table');
  }
  
  if (missingTables.includes('credit_reports')) {
    console.log('Creating credit_reports table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "credit_reports" (
        "id" text PRIMARY KEY NOT NULL,
        "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
        "file_name" text NOT NULL,
        "file_type" text NOT NULL,
        "file_url" text NOT NULL,
        "file_size" integer,
        "bureau" text,
        "report_date" timestamp,
        "parsed_at" timestamp,
        "parse_status" text DEFAULT 'pending',
        "parse_error" text,
        "raw_data" text,
        "uploaded_at" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "credit_reports_clientId_idx" ON "credit_reports" ("client_id")`);
    console.log('  Created credit_reports table');
  }
  
  if (missingTables.includes('credit_accounts')) {
    console.log('Creating credit_accounts table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "credit_accounts" (
        "id" text PRIMARY KEY NOT NULL,
        "credit_report_id" text NOT NULL REFERENCES "credit_reports"("id") ON DELETE CASCADE,
        "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
        "creditor_name" text NOT NULL,
        "account_number" text,
        "account_type" text,
        "account_status" text,
        "balance" integer,
        "credit_limit" integer,
        "high_credit" integer,
        "monthly_payment" integer,
        "past_due_amount" integer,
        "payment_status" text,
        "date_opened" timestamp,
        "date_reported" timestamp,
        "bureau" text,
        "is_negative" boolean DEFAULT false,
        "risk_level" text,
        "remarks" text,
        "created_at" timestamp DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "credit_accounts_creditReportId_idx" ON "credit_accounts" ("credit_report_id")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "credit_accounts_clientId_idx" ON "credit_accounts" ("client_id")`);
    console.log('  Created credit_accounts table');
  }
  
  if (missingTables.includes('negative_items')) {
    console.log('Creating negative_items table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "negative_items" (
        "id" text PRIMARY KEY NOT NULL,
        "credit_report_id" text NOT NULL REFERENCES "credit_reports"("id") ON DELETE CASCADE,
        "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
        "credit_account_id" text REFERENCES "credit_accounts"("id") ON DELETE SET NULL,
        "item_type" text NOT NULL,
        "creditor_name" text NOT NULL,
        "original_creditor" text,
        "amount" integer,
        "date_reported" timestamp,
        "date_of_last_activity" timestamp,
        "bureau" text,
        "risk_severity" text DEFAULT 'medium',
        "score_impact" text,
        "recommended_action" text,
        "dispute_reason" text,
        "notes" text,
        "created_at" timestamp DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "negative_items_creditReportId_idx" ON "negative_items" ("credit_report_id")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "negative_items_clientId_idx" ON "negative_items" ("client_id")`);
    console.log('  Created negative_items table');
  }
  
  if (missingTables.includes('credit_analyses')) {
    console.log('Creating credit_analyses table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "credit_analyses" (
        "id" text PRIMARY KEY NOT NULL,
        "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
        "score_transunion" integer,
        "score_experian" integer,
        "score_equifax" integer,
        "total_accounts" integer DEFAULT 0,
        "open_accounts" integer DEFAULT 0,
        "closed_accounts" integer DEFAULT 0,
        "total_debt" integer DEFAULT 0,
        "total_credit_limit" integer DEFAULT 0,
        "utilization_percent" integer,
        "derogatory_count" integer DEFAULT 0,
        "collections_count" integer DEFAULT 0,
        "late_payment_count" integer DEFAULT 0,
        "inquiry_count" integer DEFAULT 0,
        "oldest_account_age" integer,
        "average_account_age" integer,
        "analysis_summary" text,
        "recommendations" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "credit_analyses_clientId_idx" ON "credit_analyses" ("client_id")`);
    console.log('  Created credit_analyses table');
  }
  
  if (missingTables.includes('disputes')) {
    console.log('Creating disputes table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "disputes" (
        "id" text PRIMARY KEY NOT NULL,
        "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
        "negative_item_id" text REFERENCES "negative_items"("id") ON DELETE SET NULL,
        "bureau" text NOT NULL,
        "dispute_reason" text NOT NULL,
        "dispute_type" text DEFAULT 'standard',
        "status" text DEFAULT 'draft',
        "round" integer DEFAULT 1,
        "letter_content" text,
        "letter_template_id" text,
        "tracking_number" text,
        "sent_at" timestamp,
        "response_deadline" timestamp,
        "response_received_at" timestamp,
        "outcome" text,
        "response_notes" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "disputes_clientId_idx" ON "disputes" ("client_id")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "disputes_negativeItemId_idx" ON "disputes" ("negative_item_id")`);
    console.log('  Created disputes table');
  }
  
  if (missingTables.includes('dispute_letter_templates')) {
    console.log('Creating dispute_letter_templates table...');
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "dispute_letter_templates" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "dispute_type" text NOT NULL,
        "target_recipient" text DEFAULT 'bureau',
        "content" text NOT NULL,
        "variables" text,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `);
    console.log('  Created dispute_letter_templates table');
  }
  
  console.log('Migration complete!');
}

checkAndMigrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

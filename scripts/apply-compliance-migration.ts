import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.DATABASE_URL!);

async function applyMigration() {
  console.log('Applying CROA/TSR compliance tables migration...');

  try {
    // Create enums
    await sql`CREATE TYPE "public"."agreement_status" AS ENUM('draft', 'pending', 'signed', 'cancelled', 'expired')`;
    console.log('Created agreement_status enum');
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '42710') console.log('agreement_status enum already exists');
    else throw e;
  }

  try {
    await sql`CREATE TYPE "public"."disclosure_type" AS ENUM('right_to_cancel', 'no_guarantee', 'credit_bureau_rights', 'written_contract', 'fee_disclosure')`;
    console.log('Created disclosure_type enum');
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '42710') console.log('disclosure_type enum already exists');
    else throw e;
  }

  try {
    await sql`CREATE TYPE "public"."fee_model" AS ENUM('subscription', 'pay_per_delete', 'milestone', 'flat_fee')`;
    console.log('Created fee_model enum');
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '42710') console.log('fee_model enum already exists');
    else throw e;
  }

  try {
    await sql`CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'pending', 'paid', 'void', 'refunded')`;
    console.log('Created invoice_status enum');
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '42710') console.log('invoice_status enum already exists');
    else throw e;
  }

  try {
    await sql`CREATE TYPE "public"."message_thread_status" AS ENUM('open', 'closed', 'archived')`;
    console.log('Created message_thread_status enum');
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '42710') console.log('message_thread_status enum already exists');
    else throw e;
  }

  try {
    await sql`CREATE TYPE "public"."sender_type" AS ENUM('admin', 'client')`;
    console.log('Created sender_type enum');
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '42710') console.log('sender_type enum already exists');
    else throw e;
  }

  // Create tables
  try {
    await sql`
      CREATE TABLE "agreement_templates" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "version" text DEFAULT '1.0' NOT NULL,
        "content" text NOT NULL,
        "required_disclosures" text,
        "cancellation_period_days" integer DEFAULT 3,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `;
    console.log('Created agreement_templates table');
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '42P07') console.log('agreement_templates table already exists');
    else throw e;
  }

  try {
    await sql`
      CREATE TABLE "fee_configurations" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "fee_model" "fee_model" NOT NULL,
        "amount" integer NOT NULL,
        "frequency" text,
        "setup_fee" integer DEFAULT 0,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `;
    console.log('Created fee_configurations table');
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '42P07') console.log('fee_configurations table already exists');
    else throw e;
  }

  try {
    await sql`
      CREATE TABLE "client_agreements" (
        "id" text PRIMARY KEY NOT NULL,
        "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE cascade,
        "template_id" text REFERENCES "agreement_templates"("id") ON DELETE set null,
        "template_version" text,
        "status" "agreement_status" DEFAULT 'draft',
        "content" text NOT NULL,
        "signed_at" timestamp,
        "signature_data" text,
        "signature_type" text,
        "signer_ip_address" text,
        "signer_user_agent" text,
        "cancellation_deadline" timestamp,
        "cancelled_at" timestamp,
        "cancellation_reason" text,
        "sent_at" timestamp,
        "sent_by_id" text REFERENCES "user"("id") ON DELETE set null,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `;
    console.log('Created client_agreements table');
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '42P07') console.log('client_agreements table already exists');
    else throw e;
  }

  try {
    await sql`
      CREATE TABLE "disclosure_acknowledgments" (
        "id" text PRIMARY KEY NOT NULL,
        "agreement_id" text NOT NULL REFERENCES "client_agreements"("id") ON DELETE cascade,
        "disclosure_type" "disclosure_type" NOT NULL,
        "disclosure_text" text NOT NULL,
        "acknowledged" boolean DEFAULT false,
        "acknowledged_at" timestamp,
        "acknowledger_ip_address" text,
        "created_at" timestamp DEFAULT now()
      )
    `;
    console.log('Created disclosure_acknowledgments table');
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '42P07') console.log('disclosure_acknowledgments table already exists');
    else throw e;
  }

  try {
    await sql`
      CREATE TABLE "client_billing_profiles" (
        "id" text PRIMARY KEY NOT NULL,
        "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE cascade,
        "fee_config_id" text REFERENCES "fee_configurations"("id") ON DELETE set null,
        "external_customer_id" text,
        "payment_processor" text,
        "payment_method_last4" text,
        "payment_method_type" text,
        "billing_status" text DEFAULT 'active',
        "next_billing_date" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `;
    console.log('Created client_billing_profiles table');
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '42P07') console.log('client_billing_profiles table already exists');
    else throw e;
  }

  try {
    await sql`
      CREATE TABLE "invoices" (
        "id" text PRIMARY KEY NOT NULL,
        "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE cascade,
        "billing_profile_id" text REFERENCES "client_billing_profiles"("id") ON DELETE set null,
        "invoice_number" text NOT NULL UNIQUE,
        "amount" integer NOT NULL,
        "status" "invoice_status" DEFAULT 'draft',
        "services_rendered" text,
        "services_rendered_at" timestamp,
        "description" text,
        "due_date" timestamp,
        "paid_at" timestamp,
        "external_payment_id" text,
        "payment_processor" text,
        "payment_method" text,
        "refunded_at" timestamp,
        "refund_amount" integer,
        "refund_reason" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `;
    console.log('Created invoices table');
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '42P07') console.log('invoices table already exists');
    else throw e;
  }

  try {
    await sql`
      CREATE TABLE "payment_audit_log" (
        "id" text PRIMARY KEY NOT NULL,
        "client_id" text REFERENCES "clients"("id") ON DELETE set null,
        "invoice_id" text REFERENCES "invoices"("id") ON DELETE set null,
        "action" text NOT NULL,
        "details" text,
        "performed_by_id" text REFERENCES "user"("id") ON DELETE set null,
        "ip_address" text,
        "created_at" timestamp DEFAULT now()
      )
    `;
    console.log('Created payment_audit_log table');
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '42P07') console.log('payment_audit_log table already exists');
    else throw e;
  }

  try {
    await sql`
      CREATE TABLE "message_threads" (
        "id" text PRIMARY KEY NOT NULL,
        "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE cascade,
        "subject" text NOT NULL,
        "status" "message_thread_status" DEFAULT 'open',
        "last_message_at" timestamp,
        "unread_by_admin" integer DEFAULT 0,
        "unread_by_client" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
      )
    `;
    console.log('Created message_threads table');
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '42P07') console.log('message_threads table already exists');
    else throw e;
  }

  try {
    await sql`
      CREATE TABLE "messages" (
        "id" text PRIMARY KEY NOT NULL,
        "thread_id" text NOT NULL REFERENCES "message_threads"("id") ON DELETE cascade,
        "sender_id" text REFERENCES "user"("id") ON DELETE set null,
        "sender_type" "sender_type" NOT NULL,
        "content" text NOT NULL,
        "is_read" boolean DEFAULT false,
        "read_at" timestamp,
        "sender_ip_address" text,
        "created_at" timestamp DEFAULT now()
      )
    `;
    console.log('Created messages table');
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '42P07') console.log('messages table already exists');
    else throw e;
  }

  try {
    await sql`
      CREATE TABLE "message_attachments" (
        "id" text PRIMARY KEY NOT NULL,
        "message_id" text NOT NULL REFERENCES "messages"("id") ON DELETE cascade,
        "file_name" text NOT NULL,
        "file_url" text NOT NULL,
        "file_size" integer,
        "file_type" text,
        "created_at" timestamp DEFAULT now()
      )
    `;
    console.log('Created message_attachments table');
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error.code === '42P07') console.log('message_attachments table already exists');
    else throw e;
  }

  // Create indexes
  const indexes = [
    { name: 'client_agreements_clientId_idx', sql: sql`CREATE INDEX IF NOT EXISTS "client_agreements_clientId_idx" ON "client_agreements" USING btree ("client_id")` },
    { name: 'client_agreements_status_idx', sql: sql`CREATE INDEX IF NOT EXISTS "client_agreements_status_idx" ON "client_agreements" USING btree ("status")` },
    { name: 'client_billing_profiles_clientId_idx', sql: sql`CREATE INDEX IF NOT EXISTS "client_billing_profiles_clientId_idx" ON "client_billing_profiles" USING btree ("client_id")` },
    { name: 'disclosure_acknowledgments_agreementId_idx', sql: sql`CREATE INDEX IF NOT EXISTS "disclosure_acknowledgments_agreementId_idx" ON "disclosure_acknowledgments" USING btree ("agreement_id")` },
    { name: 'invoices_clientId_idx', sql: sql`CREATE INDEX IF NOT EXISTS "invoices_clientId_idx" ON "invoices" USING btree ("client_id")` },
    { name: 'invoices_status_idx', sql: sql`CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" USING btree ("status")` },
    { name: 'invoices_invoiceNumber_idx', sql: sql`CREATE INDEX IF NOT EXISTS "invoices_invoiceNumber_idx" ON "invoices" USING btree ("invoice_number")` },
    { name: 'message_attachments_messageId_idx', sql: sql`CREATE INDEX IF NOT EXISTS "message_attachments_messageId_idx" ON "message_attachments" USING btree ("message_id")` },
    { name: 'message_threads_clientId_idx', sql: sql`CREATE INDEX IF NOT EXISTS "message_threads_clientId_idx" ON "message_threads" USING btree ("client_id")` },
    { name: 'message_threads_status_idx', sql: sql`CREATE INDEX IF NOT EXISTS "message_threads_status_idx" ON "message_threads" USING btree ("status")` },
    { name: 'message_threads_lastMessageAt_idx', sql: sql`CREATE INDEX IF NOT EXISTS "message_threads_lastMessageAt_idx" ON "message_threads" USING btree ("last_message_at")` },
    { name: 'messages_threadId_idx', sql: sql`CREATE INDEX IF NOT EXISTS "messages_threadId_idx" ON "messages" USING btree ("thread_id")` },
    { name: 'messages_senderId_idx', sql: sql`CREATE INDEX IF NOT EXISTS "messages_senderId_idx" ON "messages" USING btree ("sender_id")` },
    { name: 'messages_createdAt_idx', sql: sql`CREATE INDEX IF NOT EXISTS "messages_createdAt_idx" ON "messages" USING btree ("created_at")` },
    { name: 'payment_audit_log_clientId_idx', sql: sql`CREATE INDEX IF NOT EXISTS "payment_audit_log_clientId_idx" ON "payment_audit_log" USING btree ("client_id")` },
    { name: 'payment_audit_log_invoiceId_idx', sql: sql`CREATE INDEX IF NOT EXISTS "payment_audit_log_invoiceId_idx" ON "payment_audit_log" USING btree ("invoice_id")` },
    { name: 'payment_audit_log_createdAt_idx', sql: sql`CREATE INDEX IF NOT EXISTS "payment_audit_log_createdAt_idx" ON "payment_audit_log" USING btree ("created_at")` },
  ];

  for (const idx of indexes) {
    try {
      await idx.sql;
      console.log(`Created index ${idx.name}`);
    } catch (e: unknown) {
      const error = e as { code?: string };
      if (error.code === '42P07') console.log(`Index ${idx.name} already exists`);
      else console.log(`Warning creating index ${idx.name}:`, e);
    }
  }

  console.log('\nMigration completed successfully!');
}

applyMigration().catch(console.error);

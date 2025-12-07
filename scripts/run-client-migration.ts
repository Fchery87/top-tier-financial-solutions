import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';

config({ path: '.env' });

const sql = neon(process.env.DATABASE_URL!);

async function runMigration() {
  console.log('Running client fields migration...');
  
  try {
    // Create the enum type if it doesn't exist
    console.log('Creating identity_doc_type enum...');
    await sql`
      DO $$ BEGIN
        CREATE TYPE "identity_doc_type" AS ENUM('government_id', 'ssn_card', 'proof_of_address', 'credit_report', 'other');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    
    // Add columns to clients table if they don't exist
    console.log('Adding columns to clients table...');
    
    await sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "street_address" text`;
    await sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "city" text`;
    await sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "state" text`;
    await sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "zip_code" text`;
    await sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "date_of_birth" timestamp`;
    await sql`ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "ssn_last_4" text`;
    
    // Create client_identity_documents table if it doesn't exist
    console.log('Creating client_identity_documents table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "client_identity_documents" (
        "id" text PRIMARY KEY NOT NULL,
        "client_id" text NOT NULL,
        "document_type" "identity_doc_type" NOT NULL,
        "file_name" text NOT NULL,
        "file_url" text NOT NULL,
        "file_size" integer,
        "mime_type" text,
        "uploaded_by_id" text,
        "notes" text,
        "created_at" timestamp DEFAULT now()
      )
    `;
    
    // Add foreign keys if they don't exist
    console.log('Adding foreign keys...');
    await sql`
      DO $$ BEGIN
        ALTER TABLE "client_identity_documents" 
          ADD CONSTRAINT "client_identity_documents_client_id_clients_id_fk" 
          FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    
    await sql`
      DO $$ BEGIN
        ALTER TABLE "client_identity_documents" 
          ADD CONSTRAINT "client_identity_documents_uploaded_by_id_user_id_fk" 
          FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    
    // Create index
    console.log('Creating indexes...');
    await sql`
      CREATE INDEX IF NOT EXISTS "client_identity_documents_clientId_idx" 
      ON "client_identity_documents" USING btree ("client_id")
    `;
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();

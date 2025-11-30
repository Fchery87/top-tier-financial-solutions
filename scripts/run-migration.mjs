import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

console.log('Connecting to database...');
const sql = neon(process.env.DATABASE_URL);

const statements = [
  `CREATE TABLE IF NOT EXISTS "blog_categories" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "slug" text NOT NULL,
    "description" text,
    "order_index" integer DEFAULT 0,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    CONSTRAINT "blog_categories_slug_unique" UNIQUE("slug")
  )`,
  
  `CREATE TABLE IF NOT EXISTS "blog_posts" (
    "id" text PRIMARY KEY NOT NULL,
    "title" text NOT NULL,
    "slug" text NOT NULL,
    "excerpt" text,
    "content" text NOT NULL,
    "featured_image" text,
    "category_id" text,
    "author_id" text,
    "meta_title" text,
    "meta_description" text,
    "is_published" boolean DEFAULT false,
    "is_featured" boolean DEFAULT false,
    "published_at" timestamp,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
  )`,
  
  `CREATE TABLE IF NOT EXISTS "client_cases" (
    "id" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "case_number" text NOT NULL,
    "status" text DEFAULT 'active',
    "current_phase" text DEFAULT 'initial_review',
    "credit_score_start" integer,
    "credit_score_current" integer,
    "negative_items_start" integer,
    "negative_items_removed" integer DEFAULT 0,
    "notes" text,
    "started_at" timestamp DEFAULT now(),
    "completed_at" timestamp,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    CONSTRAINT "client_cases_case_number_unique" UNIQUE("case_number")
  )`,
  
  `CREATE TABLE IF NOT EXISTS "case_updates" (
    "id" text PRIMARY KEY NOT NULL,
    "case_id" text NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "update_type" text DEFAULT 'general',
    "is_visible_to_client" boolean DEFAULT true,
    "created_at" timestamp DEFAULT now()
  )`,
  
  `CREATE TABLE IF NOT EXISTS "client_documents" (
    "id" text PRIMARY KEY NOT NULL,
    "case_id" text NOT NULL,
    "user_id" text NOT NULL,
    "file_name" text NOT NULL,
    "file_type" text,
    "file_url" text NOT NULL,
    "file_size" integer,
    "uploaded_by" text DEFAULT 'client',
    "notes" text,
    "created_at" timestamp DEFAULT now()
  )`,
  
  `CREATE TABLE IF NOT EXISTS "email_subscribers" (
    "id" text PRIMARY KEY NOT NULL,
    "email" text NOT NULL,
    "first_name" text,
    "last_name" text,
    "source" text DEFAULT 'website',
    "status" text DEFAULT 'active',
    "subscribed_at" timestamp DEFAULT now(),
    "unsubscribed_at" timestamp,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now(),
    CONSTRAINT "email_subscribers_email_unique" UNIQUE("email")
  )`,
  
  `CREATE TABLE IF NOT EXISTS "email_campaigns" (
    "id" text PRIMARY KEY NOT NULL,
    "name" text NOT NULL,
    "subject" text NOT NULL,
    "content" text NOT NULL,
    "campaign_type" text DEFAULT 'newsletter',
    "status" text DEFAULT 'draft',
    "scheduled_at" timestamp,
    "sent_at" timestamp,
    "recipient_count" integer DEFAULT 0,
    "open_count" integer DEFAULT 0,
    "click_count" integer DEFAULT 0,
    "created_at" timestamp DEFAULT now(),
    "updated_at" timestamp DEFAULT now()
  )`,
];

const foreignKeys = [
  `DO $$ BEGIN
    ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_blog_categories_id_fk" 
    FOREIGN KEY ("category_id") REFERENCES "public"."blog_categories"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`,
  
  `DO $$ BEGIN
    ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_user_id_fk" 
    FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`,
  
  `DO $$ BEGIN
    ALTER TABLE "case_updates" ADD CONSTRAINT "case_updates_case_id_client_cases_id_fk" 
    FOREIGN KEY ("case_id") REFERENCES "public"."client_cases"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`,
  
  `DO $$ BEGIN
    ALTER TABLE "client_cases" ADD CONSTRAINT "client_cases_user_id_user_id_fk" 
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`,
  
  `DO $$ BEGIN
    ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_case_id_client_cases_id_fk" 
    FOREIGN KEY ("case_id") REFERENCES "public"."client_cases"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`,
  
  `DO $$ BEGIN
    ALTER TABLE "client_documents" ADD CONSTRAINT "client_documents_user_id_user_id_fk" 
    FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
  EXCEPTION WHEN duplicate_object THEN null; END $$`,
];

const indexes = [
  `CREATE INDEX IF NOT EXISTS "blog_posts_slug_idx" ON "blog_posts" USING btree ("slug")`,
  `CREATE INDEX IF NOT EXISTS "blog_posts_categoryId_idx" ON "blog_posts" USING btree ("category_id")`,
  `CREATE INDEX IF NOT EXISTS "case_updates_caseId_idx" ON "case_updates" USING btree ("case_id")`,
  `CREATE INDEX IF NOT EXISTS "client_cases_userId_idx" ON "client_cases" USING btree ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "client_documents_caseId_idx" ON "client_documents" USING btree ("case_id")`,
  `CREATE INDEX IF NOT EXISTS "client_documents_userId_idx" ON "client_documents" USING btree ("user_id")`,
  `CREATE INDEX IF NOT EXISTS "email_subscribers_email_idx" ON "email_subscribers" USING btree ("email")`,
];

async function run() {
  console.log('Running migration...\n');
  
  // Test connection first
  try {
    const result = await sql`SELECT current_database(), current_schema()`;
    console.log('Connected to:', result[0]);
  } catch (e) {
    console.error('Connection failed:', e.message);
    process.exit(1);
  }
  
  console.log('\nCreating tables...');
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const tableName = stmt.match(/CREATE TABLE IF NOT EXISTS "(\w+)"/)?.[1] || `table ${i+1}`;
    try {
      await sql.query(stmt);
      console.log(`  ✓ ${tableName} created`);
    } catch (e) {
      console.error(`  ✗ ${tableName} error:`, e.message);
    }
  }
  
  console.log('\nAdding foreign keys...');
  for (let i = 0; i < foreignKeys.length; i++) {
    try {
      await sql.query(foreignKeys[i]);
      console.log(`  ✓ FK ${i+1} added`);
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log(`  ✓ FK ${i+1} already exists`);
      } else {
        console.error(`  ✗ FK ${i+1} error:`, e.message);
      }
    }
  }
  
  console.log('\nCreating indexes...');
  for (let i = 0; i < indexes.length; i++) {
    const indexName = indexes[i].match(/CREATE INDEX IF NOT EXISTS "(\w+)"/)?.[1] || `index ${i+1}`;
    try {
      await sql.query(indexes[i]);
      console.log(`  ✓ ${indexName} created`);
    } catch (e) {
      console.error(`  ✗ ${indexName} error:`, e.message);
    }
  }
  
  // Verify tables exist
  console.log('\nVerifying tables...');
  const tables = await sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('blog_posts', 'blog_categories', 'client_cases', 'case_updates', 'client_documents', 'email_subscribers', 'email_campaigns')
  `;
  console.log('Tables found:', tables.map(t => t.table_name).join(', ') || 'NONE');
  
  console.log('\n✓ Migration complete!');
}

run().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});

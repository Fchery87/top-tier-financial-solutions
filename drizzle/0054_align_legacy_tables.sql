-- Aligns the legacy public-site tables (and clients.lead_id) with the shape production
-- already has. On production (ids already uuid) this migration changes nothing; it only
-- converges a database rebuilt from the journal, where these tables start as text/defaults.
DO $align$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'consultation_requests' AND column_name = 'id' AND data_type = 'text') THEN
    ALTER TABLE "clients" DROP CONSTRAINT IF EXISTS "clients_lead_id_consultation_requests_id_fk";
    ALTER TABLE "clients" ALTER COLUMN "lead_id" SET DATA TYPE uuid USING "lead_id"::uuid;
    ALTER TABLE "consultation_requests" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
    ALTER TABLE "consultation_requests" ALTER COLUMN "first_name" SET DATA TYPE varchar(255);
    ALTER TABLE "consultation_requests" ALTER COLUMN "last_name" SET DATA TYPE varchar(255);
    ALTER TABLE "consultation_requests" ALTER COLUMN "email" SET DATA TYPE varchar(255);
    ALTER TABLE "consultation_requests" ALTER COLUMN "phone_number" SET DATA TYPE varchar(50);
    ALTER TABLE "consultation_requests" ALTER COLUMN "message" SET DATA TYPE varchar;
    ALTER TABLE "consultation_requests" ALTER COLUMN "source_page_slug" SET DATA TYPE varchar(255);
    ALTER TABLE "consultation_requests" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "consultation_requests" ALTER COLUMN "requested_at" DROP DEFAULT;
    ALTER TABLE "consultation_requests" ALTER COLUMN "requested_at" SET NOT NULL;
    ALTER TABLE "consultation_requests" ALTER COLUMN "updated_at" DROP DEFAULT;
    ALTER TABLE "consultation_requests" ALTER COLUMN "updated_at" SET NOT NULL;
    ALTER TABLE "disclaimers" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
    ALTER TABLE "disclaimers" ALTER COLUMN "name" SET DATA TYPE varchar(255);
    ALTER TABLE "disclaimers" ALTER COLUMN "content" SET DATA TYPE varchar;
    ALTER TABLE "disclaimers" ALTER COLUMN "display_hint" SET DATA TYPE varchar(255);
    ALTER TABLE "disclaimers" ALTER COLUMN "is_active" DROP DEFAULT;
    ALTER TABLE "disclaimers" ALTER COLUMN "is_active" SET NOT NULL;
    ALTER TABLE "disclaimers" ALTER COLUMN "created_at" DROP DEFAULT;
    ALTER TABLE "disclaimers" ALTER COLUMN "created_at" SET NOT NULL;
    ALTER TABLE "disclaimers" ALTER COLUMN "updated_at" DROP DEFAULT;
    ALTER TABLE "disclaimers" ALTER COLUMN "updated_at" SET NOT NULL;
    ALTER TABLE "faq_items" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
    ALTER TABLE "faq_items" ALTER COLUMN "question" SET DATA TYPE varchar(500);
    ALTER TABLE "faq_items" ALTER COLUMN "answer" SET DATA TYPE varchar;
    ALTER TABLE "faq_items" ALTER COLUMN "display_order" DROP DEFAULT;
    ALTER TABLE "faq_items" ALTER COLUMN "display_order" SET NOT NULL;
    ALTER TABLE "faq_items" ALTER COLUMN "is_published" DROP DEFAULT;
    ALTER TABLE "faq_items" ALTER COLUMN "is_published" SET NOT NULL;
    ALTER TABLE "faq_items" ALTER COLUMN "created_at" DROP DEFAULT;
    ALTER TABLE "faq_items" ALTER COLUMN "created_at" SET NOT NULL;
    ALTER TABLE "faq_items" ALTER COLUMN "updated_at" DROP DEFAULT;
    ALTER TABLE "faq_items" ALTER COLUMN "updated_at" SET NOT NULL;
    ALTER TABLE "pages" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
    ALTER TABLE "pages" ALTER COLUMN "slug" SET DATA TYPE varchar(255);
    ALTER TABLE "pages" ALTER COLUMN "title" SET DATA TYPE varchar(255);
    ALTER TABLE "pages" ALTER COLUMN "hero_headline" SET DATA TYPE varchar(500);
    ALTER TABLE "pages" ALTER COLUMN "hero_subheadline" SET DATA TYPE varchar;
    ALTER TABLE "pages" ALTER COLUMN "main_content_json" SET DATA TYPE varchar;
    ALTER TABLE "pages" ALTER COLUMN "cta_text" SET DATA TYPE varchar(255);
    ALTER TABLE "pages" ALTER COLUMN "cta_link" SET DATA TYPE varchar(2048);
    ALTER TABLE "pages" ALTER COLUMN "meta_title" SET DATA TYPE varchar(255);
    ALTER TABLE "pages" ALTER COLUMN "meta_description" SET DATA TYPE varchar;
    ALTER TABLE "pages" ALTER COLUMN "is_published" DROP DEFAULT;
    ALTER TABLE "pages" ALTER COLUMN "is_published" SET NOT NULL;
    ALTER TABLE "pages" ALTER COLUMN "created_at" DROP DEFAULT;
    ALTER TABLE "pages" ALTER COLUMN "created_at" SET NOT NULL;
    ALTER TABLE "pages" ALTER COLUMN "updated_at" DROP DEFAULT;
    ALTER TABLE "pages" ALTER COLUMN "updated_at" SET NOT NULL;
    ALTER TABLE "services" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
    ALTER TABLE "services" ALTER COLUMN "name" SET DATA TYPE varchar(255);
    ALTER TABLE "services" ALTER COLUMN "description" SET DATA TYPE varchar;
    ALTER TABLE "services" ALTER COLUMN "description" SET NOT NULL;
    ALTER TABLE "services" ALTER COLUMN "order_index" DROP DEFAULT;
    ALTER TABLE "services" ALTER COLUMN "order_index" SET NOT NULL;
    ALTER TABLE "services" ALTER COLUMN "created_at" DROP DEFAULT;
    ALTER TABLE "services" ALTER COLUMN "created_at" SET NOT NULL;
    ALTER TABLE "services" ALTER COLUMN "updated_at" DROP DEFAULT;
    ALTER TABLE "services" ALTER COLUMN "updated_at" SET NOT NULL;
    ALTER TABLE "testimonials" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;
    ALTER TABLE "testimonials" ALTER COLUMN "author_name" SET DATA TYPE varchar(255);
    ALTER TABLE "testimonials" ALTER COLUMN "author_location" SET DATA TYPE varchar(255);
    ALTER TABLE "testimonials" ALTER COLUMN "quote" SET DATA TYPE varchar;
    ALTER TABLE "testimonials" ALTER COLUMN "order_index" DROP DEFAULT;
    ALTER TABLE "testimonials" ALTER COLUMN "order_index" SET NOT NULL;
    ALTER TABLE "testimonials" ALTER COLUMN "is_approved" DROP DEFAULT;
    ALTER TABLE "testimonials" ALTER COLUMN "is_approved" SET NOT NULL;
    ALTER TABLE "testimonials" ALTER COLUMN "created_at" DROP DEFAULT;
    ALTER TABLE "testimonials" ALTER COLUMN "created_at" SET NOT NULL;
    ALTER TABLE "testimonials" ALTER COLUMN "updated_at" DROP DEFAULT;
    ALTER TABLE "testimonials" ALTER COLUMN "updated_at" SET NOT NULL;
    ALTER TABLE "clients" ADD CONSTRAINT "clients_lead_id_consultation_requests_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."consultation_requests"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $align$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_consultation_requests_email" ON "consultation_requests" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_consultation_requests_status" ON "consultation_requests" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ix_disclaimers_name" ON "disclaimers" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_faq_items_display_order" ON "faq_items" USING btree ("display_order");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ix_pages_slug" ON "pages" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ix_services_name" ON "services" USING btree ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_testimonials_order_index" ON "testimonials" USING btree ("order_index");

CREATE TABLE "dispute_batches" (
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
);
--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "batch_id" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "reason_codes" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "escalation_path" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "generated_by_ai" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "dispute_batches" ADD CONSTRAINT "dispute_batches_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispute_batches_clientId_idx" ON "dispute_batches" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "dispute_batches_status_idx" ON "dispute_batches" USING btree ("status");--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_batch_id_dispute_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."dispute_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "disputes_batchId_idx" ON "disputes" USING btree ("batch_id");
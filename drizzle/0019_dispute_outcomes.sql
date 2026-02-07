CREATE TABLE IF NOT EXISTS "dispute_outcomes" (
  "id" text PRIMARY KEY NOT NULL,
  "dispute_id" text NOT NULL,
  "client_id" text NOT NULL,
  "bureau" text,
  "round" integer,
  "outcome" text NOT NULL,
  "response_type" text,
  "response_channel" text,
  "response_date" timestamp,
  "score_impact" integer,
  "reason_codes" text,
  "methodology" text,
  "dispute_type" text,
  "item_type" text,
  "creditor_name" text,
  "analysis_confidence" integer,
  "next_dispute_id" text,
  "response_document_url" text,
  "notes" text,
  "created_by" text,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "dispute_outcomes"
  ADD CONSTRAINT "dispute_outcomes_dispute_id_disputes_id_fk"
  FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id")
  ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "dispute_outcomes"
  ADD CONSTRAINT "dispute_outcomes_client_id_clients_id_fk"
  FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id")
  ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "dispute_outcomes"
  ADD CONSTRAINT "dispute_outcomes_next_dispute_id_disputes_id_fk"
  FOREIGN KEY ("next_dispute_id") REFERENCES "public"."disputes"("id")
  ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "dispute_outcomes"
  ADD CONSTRAINT "dispute_outcomes_created_by_user_id_fk"
  FOREIGN KEY ("created_by") REFERENCES "public"."user"("id")
  ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dispute_outcomes_disputeId_idx" ON "dispute_outcomes" ("dispute_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dispute_outcomes_clientId_idx" ON "dispute_outcomes" ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dispute_outcomes_outcome_idx" ON "dispute_outcomes" ("outcome");

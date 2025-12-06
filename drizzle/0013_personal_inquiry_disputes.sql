CREATE TABLE IF NOT EXISTS "personal_info_disputes" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL,
  "credit_report_id" text,
  "bureau" text NOT NULL,
  "type" text NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "inquiry_disputes" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL,
  "credit_report_id" text,
  "creditor_name" text NOT NULL,
  "bureau" text,
  "inquiry_date" timestamp,
  "inquiry_type" text,
  "is_past_fcra_limit" boolean DEFAULT false,
  "days_since_inquiry" integer,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "personal_info_disputes_clientId_idx" ON "personal_info_disputes" ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "personal_info_disputes_creditReportId_idx" ON "personal_info_disputes" ("credit_report_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "personal_info_disputes_bureau_idx" ON "personal_info_disputes" ("bureau");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiry_disputes_clientId_idx" ON "inquiry_disputes" ("client_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiry_disputes_creditReportId_idx" ON "inquiry_disputes" ("credit_report_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inquiry_disputes_bureau_idx" ON "inquiry_disputes" ("bureau");
--> statement-breakpoint
ALTER TABLE "personal_info_disputes" ADD CONSTRAINT "personal_info_disputes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "personal_info_disputes" ADD CONSTRAINT "personal_info_disputes_credit_report_id_credit_reports_id_fk" FOREIGN KEY ("credit_report_id") REFERENCES "public"."credit_reports"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inquiry_disputes" ADD CONSTRAINT "inquiry_disputes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "inquiry_disputes" ADD CONSTRAINT "inquiry_disputes_credit_report_id_credit_reports_id_fk" FOREIGN KEY ("credit_report_id") REFERENCES "public"."credit_reports"("id") ON DELETE cascade ON UPDATE no action;

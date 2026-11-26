ALTER TABLE "bureau_discrepancies" ADD COLUMN IF NOT EXISTS "credit_report_id" text;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD COLUMN IF NOT EXISTS "payment_history_grid" text;--> statement-breakpoint
ALTER TABLE "negative_items" ADD COLUMN IF NOT EXISTS "credit_account_match_confidence" integer;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "bureau_discrepancies" ADD CONSTRAINT "bureau_discrepancies_credit_report_id_credit_reports_id_fk" FOREIGN KEY ("credit_report_id") REFERENCES "public"."credit_reports"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bureau_discrepancies_creditReportId_idx" ON "bureau_discrepancies" USING btree ("credit_report_id");
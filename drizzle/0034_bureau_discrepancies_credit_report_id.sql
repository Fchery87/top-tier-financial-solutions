ALTER TABLE "bureau_discrepancies" ADD COLUMN "credit_report_id" text;--> statement-breakpoint
ALTER TABLE "bureau_discrepancies" ADD CONSTRAINT "bureau_discrepancies_credit_report_id_credit_reports_id_fk" FOREIGN KEY ("credit_report_id") REFERENCES "public"."credit_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bureau_discrepancies_creditReportId_idx" ON "bureau_discrepancies" USING btree ("credit_report_id");

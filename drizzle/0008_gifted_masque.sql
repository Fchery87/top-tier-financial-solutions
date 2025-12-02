CREATE TABLE "credit_score_history" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"credit_report_id" text,
	"score_transunion" integer,
	"score_experian" integer,
	"score_equifax" integer,
	"average_score" integer,
	"source" text DEFAULT 'credit_report',
	"notes" text,
	"recorded_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "response_document_url" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "verification_method" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "escalation_reason" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "creditor_name" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "account_number" text;--> statement-breakpoint
ALTER TABLE "credit_score_history" ADD CONSTRAINT "credit_score_history_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_score_history" ADD CONSTRAINT "credit_score_history_credit_report_id_credit_reports_id_fk" FOREIGN KEY ("credit_report_id") REFERENCES "public"."credit_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_score_history_clientId_idx" ON "credit_score_history" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "credit_score_history_recordedAt_idx" ON "credit_score_history" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "disputes_responseDeadline_idx" ON "disputes" USING btree ("response_deadline");
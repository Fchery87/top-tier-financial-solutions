CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"lead_id" text,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"status" text DEFAULT 'active',
	"notes" text,
	"converted_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"credit_report_id" text NOT NULL,
	"client_id" text NOT NULL,
	"creditor_name" text NOT NULL,
	"account_number" text,
	"account_type" text,
	"account_status" text,
	"balance" integer,
	"credit_limit" integer,
	"high_credit" integer,
	"monthly_payment" integer,
	"past_due_amount" integer,
	"payment_status" text,
	"date_opened" timestamp,
	"date_reported" timestamp,
	"bureau" text,
	"is_negative" boolean DEFAULT false,
	"risk_level" text,
	"remarks" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"score_transunion" integer,
	"score_experian" integer,
	"score_equifax" integer,
	"total_accounts" integer DEFAULT 0,
	"open_accounts" integer DEFAULT 0,
	"closed_accounts" integer DEFAULT 0,
	"total_debt" integer DEFAULT 0,
	"total_credit_limit" integer DEFAULT 0,
	"utilization_percent" integer,
	"derogatory_count" integer DEFAULT 0,
	"collections_count" integer DEFAULT 0,
	"late_payment_count" integer DEFAULT 0,
	"inquiry_count" integer DEFAULT 0,
	"oldest_account_age" integer,
	"average_account_age" integer,
	"analysis_summary" text,
	"recommendations" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"bureau" text,
	"report_date" timestamp,
	"parsed_at" timestamp,
	"parse_status" text DEFAULT 'pending',
	"parse_error" text,
	"raw_data" text,
	"uploaded_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dispute_letter_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"dispute_type" text NOT NULL,
	"target_recipient" text DEFAULT 'bureau',
	"content" text NOT NULL,
	"variables" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"negative_item_id" text,
	"bureau" text NOT NULL,
	"dispute_reason" text NOT NULL,
	"dispute_type" text DEFAULT 'standard',
	"status" text DEFAULT 'draft',
	"round" integer DEFAULT 1,
	"letter_content" text,
	"letter_template_id" text,
	"tracking_number" text,
	"sent_at" timestamp,
	"response_deadline" timestamp,
	"response_received_at" timestamp,
	"outcome" text,
	"response_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "negative_items" (
	"id" text PRIMARY KEY NOT NULL,
	"credit_report_id" text NOT NULL,
	"client_id" text NOT NULL,
	"credit_account_id" text,
	"item_type" text NOT NULL,
	"creditor_name" text NOT NULL,
	"original_creditor" text,
	"amount" integer,
	"date_reported" timestamp,
	"date_of_last_activity" timestamp,
	"bureau" text,
	"risk_severity" text DEFAULT 'medium',
	"score_impact" text,
	"recommended_action" text,
	"dispute_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_lead_id_consultation_requests_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."consultation_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_credit_report_id_credit_reports_id_fk" FOREIGN KEY ("credit_report_id") REFERENCES "public"."credit_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_analyses" ADD CONSTRAINT "credit_analyses_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_reports" ADD CONSTRAINT "credit_reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_negative_item_id_negative_items_id_fk" FOREIGN KEY ("negative_item_id") REFERENCES "public"."negative_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negative_items" ADD CONSTRAINT "negative_items_credit_report_id_credit_reports_id_fk" FOREIGN KEY ("credit_report_id") REFERENCES "public"."credit_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negative_items" ADD CONSTRAINT "negative_items_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negative_items" ADD CONSTRAINT "negative_items_credit_account_id_credit_accounts_id_fk" FOREIGN KEY ("credit_account_id") REFERENCES "public"."credit_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_userId_idx" ON "clients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clients_email_idx" ON "clients" USING btree ("email");--> statement-breakpoint
CREATE INDEX "credit_accounts_creditReportId_idx" ON "credit_accounts" USING btree ("credit_report_id");--> statement-breakpoint
CREATE INDEX "credit_accounts_clientId_idx" ON "credit_accounts" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "credit_analyses_clientId_idx" ON "credit_analyses" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "credit_reports_clientId_idx" ON "credit_reports" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "disputes_clientId_idx" ON "disputes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "disputes_negativeItemId_idx" ON "disputes" USING btree ("negative_item_id");--> statement-breakpoint
CREATE INDEX "negative_items_creditReportId_idx" ON "negative_items" USING btree ("credit_report_id");--> statement-breakpoint
CREATE INDEX "negative_items_clientId_idx" ON "negative_items" USING btree ("client_id");
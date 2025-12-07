CREATE TYPE "public"."identity_doc_type" AS ENUM('government_id', 'ssn_card', 'proof_of_address', 'credit_report', 'other');--> statement-breakpoint
CREATE TABLE "client_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"context" text NOT NULL,
	"rating" integer,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_identity_documents" (
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
);
--> statement-breakpoint
CREATE TABLE "inquiry_disputes" (
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
CREATE TABLE "letter_approvals" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"dispute_id" text,
	"batch_id" text,
	"round" integer,
	"status" text DEFAULT 'pending',
	"approval_method" text,
	"signature_text" text,
	"signature_ip" text,
	"signature_user_agent" text,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "personal_info_disputes" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"credit_report_id" text,
	"bureau" text NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sla_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"stage" text NOT NULL,
	"max_days" integer NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sla_instances" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"definition_id" text NOT NULL,
	"stage" text,
	"started_at" timestamp DEFAULT now(),
	"due_at" timestamp,
	"completed_at" timestamp,
	"status" text DEFAULT 'active',
	"breach_notified_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "street_address" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "zip_code" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "date_of_birth" timestamp;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "ssn_last_4" text;--> statement-breakpoint
ALTER TABLE "dispute_letter_templates" ADD COLUMN "evidence_requirements" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "escalation_ready_at" timestamp;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "evidence_document_ids" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "visible_to_client" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "is_blocking" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "client_feedback" ADD CONSTRAINT "client_feedback_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_identity_documents" ADD CONSTRAINT "client_identity_documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_identity_documents" ADD CONSTRAINT "client_identity_documents_uploaded_by_id_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_disputes" ADD CONSTRAINT "inquiry_disputes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiry_disputes" ADD CONSTRAINT "inquiry_disputes_credit_report_id_credit_reports_id_fk" FOREIGN KEY ("credit_report_id") REFERENCES "public"."credit_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_approvals" ADD CONSTRAINT "letter_approvals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_approvals" ADD CONSTRAINT "letter_approvals_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "letter_approvals" ADD CONSTRAINT "letter_approvals_batch_id_dispute_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."dispute_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_info_disputes" ADD CONSTRAINT "personal_info_disputes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_info_disputes" ADD CONSTRAINT "personal_info_disputes_credit_report_id_credit_reports_id_fk" FOREIGN KEY ("credit_report_id") REFERENCES "public"."credit_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_instances" ADD CONSTRAINT "sla_instances_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_instances" ADD CONSTRAINT "sla_instances_definition_id_sla_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."sla_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_feedback_clientId_idx" ON "client_feedback" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_feedback_context_idx" ON "client_feedback" USING btree ("context");--> statement-breakpoint
CREATE INDEX "client_identity_documents_clientId_idx" ON "client_identity_documents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "inquiry_disputes_clientId_idx" ON "inquiry_disputes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "inquiry_disputes_creditReportId_idx" ON "inquiry_disputes" USING btree ("credit_report_id");--> statement-breakpoint
CREATE INDEX "inquiry_disputes_bureau_idx" ON "inquiry_disputes" USING btree ("bureau");--> statement-breakpoint
CREATE INDEX "letter_approvals_clientId_idx" ON "letter_approvals" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "letter_approvals_disputeId_idx" ON "letter_approvals" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "letter_approvals_batchId_idx" ON "letter_approvals" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "personal_info_disputes_clientId_idx" ON "personal_info_disputes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "personal_info_disputes_creditReportId_idx" ON "personal_info_disputes" USING btree ("credit_report_id");--> statement-breakpoint
CREATE INDEX "personal_info_disputes_bureau_idx" ON "personal_info_disputes" USING btree ("bureau");--> statement-breakpoint
CREATE INDEX "sla_definitions_stage_idx" ON "sla_definitions" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "sla_definitions_isActive_idx" ON "sla_definitions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "sla_instances_clientId_idx" ON "sla_instances" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "sla_instances_definitionId_idx" ON "sla_instances" USING btree ("definition_id");--> statement-breakpoint
CREATE INDEX "sla_instances_status_idx" ON "sla_instances" USING btree ("status");--> statement-breakpoint
CREATE INDEX "disputes_escalationReadyAt_idx" ON "disputes" USING btree ("escalation_ready_at");
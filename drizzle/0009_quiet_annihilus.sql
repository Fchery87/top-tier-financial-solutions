CREATE TYPE "public"."email_trigger_type" AS ENUM('welcome', 'dispute_created', 'dispute_sent', 'response_received', 'item_deleted', 'progress_report', 'agreement_sent', 'agreement_signed', 'payment_received', 'custom');--> statement-breakpoint
CREATE TABLE "client_notification_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"email_enabled" boolean DEFAULT true,
	"dispute_updates" boolean DEFAULT true,
	"progress_reports" boolean DEFAULT true,
	"marketing_emails" boolean DEFAULT false,
	"preferred_frequency" text DEFAULT 'immediate',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dispute_letter_library" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"methodology" text NOT NULL,
	"target_recipient" text NOT NULL,
	"round" integer DEFAULT 1,
	"item_types" text,
	"bureau" text,
	"reason_codes" text,
	"content" text NOT NULL,
	"prompt_context" text,
	"variables" text,
	"legal_citations" text,
	"times_used" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"effectiveness_rating" integer,
	"last_used_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_automation_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"trigger_type" "email_trigger_type" NOT NULL,
	"delay_minutes" integer DEFAULT 0,
	"conditions" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_send_log" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text,
	"template_id" text,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"trigger_type" "email_trigger_type",
	"status" text DEFAULT 'pending',
	"error_message" text,
	"sent_at" timestamp,
	"opened_at" timestamp,
	"clicked_at" timestamp,
	"metadata" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"trigger_type" "email_trigger_type" NOT NULL,
	"subject" text NOT NULL,
	"html_content" text NOT NULL,
	"text_content" text,
	"variables" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "methodology" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "disputed_fields" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "fcra_sections" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "escalation_history" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "prior_dispute_id" text;--> statement-breakpoint
ALTER TABLE "client_notification_preferences" ADD CONSTRAINT "client_notification_preferences_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_automation_rules" ADD CONSTRAINT "email_automation_rules_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_send_log" ADD CONSTRAINT "email_send_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_send_log" ADD CONSTRAINT "email_send_log_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_notification_preferences_clientId_idx" ON "client_notification_preferences" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "dispute_letter_library_methodology_idx" ON "dispute_letter_library" USING btree ("methodology");--> statement-breakpoint
CREATE INDEX "dispute_letter_library_targetRecipient_idx" ON "dispute_letter_library" USING btree ("target_recipient");--> statement-breakpoint
CREATE INDEX "dispute_letter_library_round_idx" ON "dispute_letter_library" USING btree ("round");--> statement-breakpoint
CREATE INDEX "email_automation_rules_templateId_idx" ON "email_automation_rules" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "email_automation_rules_triggerType_idx" ON "email_automation_rules" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "email_send_log_clientId_idx" ON "email_send_log" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "email_send_log_status_idx" ON "email_send_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_send_log_triggerType_idx" ON "email_send_log" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "disputes_methodology_idx" ON "disputes" USING btree ("methodology");
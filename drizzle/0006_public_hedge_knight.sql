CREATE TYPE "public"."agreement_status" AS ENUM('draft', 'pending', 'signed', 'cancelled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."disclosure_type" AS ENUM('right_to_cancel', 'no_guarantee', 'credit_bureau_rights', 'written_contract', 'fee_disclosure');--> statement-breakpoint
CREATE TYPE "public"."fee_model" AS ENUM('subscription', 'pay_per_delete', 'milestone', 'flat_fee');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'pending', 'paid', 'void', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."message_thread_status" AS ENUM('open', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."sender_type" AS ENUM('admin', 'client');--> statement-breakpoint
CREATE TABLE "agreement_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"content" text NOT NULL,
	"required_disclosures" text,
	"cancellation_period_days" integer DEFAULT 3,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_agreements" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"template_id" text,
	"template_version" text,
	"status" "agreement_status" DEFAULT 'draft',
	"content" text NOT NULL,
	"signed_at" timestamp,
	"signature_data" text,
	"signature_type" text,
	"signer_ip_address" text,
	"signer_user_agent" text,
	"cancellation_deadline" timestamp,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"sent_at" timestamp,
	"sent_by_id" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_billing_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"fee_config_id" text,
	"external_customer_id" text,
	"payment_processor" text,
	"payment_method_last4" text,
	"payment_method_type" text,
	"billing_status" text DEFAULT 'active',
	"next_billing_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "disclosure_acknowledgments" (
	"id" text PRIMARY KEY NOT NULL,
	"agreement_id" text NOT NULL,
	"disclosure_type" "disclosure_type" NOT NULL,
	"disclosure_text" text NOT NULL,
	"acknowledged" boolean DEFAULT false,
	"acknowledged_at" timestamp,
	"acknowledger_ip_address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fee_configurations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"fee_model" "fee_model" NOT NULL,
	"amount" integer NOT NULL,
	"frequency" text,
	"setup_fee" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"billing_profile_id" text,
	"invoice_number" text NOT NULL,
	"amount" integer NOT NULL,
	"status" "invoice_status" DEFAULT 'draft',
	"services_rendered" text,
	"services_rendered_at" timestamp,
	"description" text,
	"due_date" timestamp,
	"paid_at" timestamp,
	"external_payment_id" text,
	"payment_processor" text,
	"payment_method" text,
	"refunded_at" timestamp,
	"refund_amount" integer,
	"refund_reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "invoices_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
CREATE TABLE "message_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"file_type" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "message_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"subject" text NOT NULL,
	"status" "message_thread_status" DEFAULT 'open',
	"last_message_at" timestamp,
	"unread_by_admin" integer DEFAULT 0,
	"unread_by_client" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"sender_id" text,
	"sender_type" "sender_type" NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"sender_ip_address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text,
	"invoice_id" text,
	"action" text NOT NULL,
	"details" text,
	"performed_by_id" text,
	"ip_address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "client_agreements" ADD CONSTRAINT "client_agreements_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_agreements" ADD CONSTRAINT "client_agreements_template_id_agreement_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."agreement_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_agreements" ADD CONSTRAINT "client_agreements_sent_by_id_user_id_fk" FOREIGN KEY ("sent_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_billing_profiles" ADD CONSTRAINT "client_billing_profiles_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_billing_profiles" ADD CONSTRAINT "client_billing_profiles_fee_config_id_fee_configurations_id_fk" FOREIGN KEY ("fee_config_id") REFERENCES "public"."fee_configurations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disclosure_acknowledgments" ADD CONSTRAINT "disclosure_acknowledgments_agreement_id_client_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."client_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billing_profile_id_client_billing_profiles_id_fk" FOREIGN KEY ("billing_profile_id") REFERENCES "public"."client_billing_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_audit_log" ADD CONSTRAINT "payment_audit_log_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_audit_log" ADD CONSTRAINT "payment_audit_log_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_audit_log" ADD CONSTRAINT "payment_audit_log_performed_by_id_user_id_fk" FOREIGN KEY ("performed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_agreements_clientId_idx" ON "client_agreements" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_agreements_status_idx" ON "client_agreements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "client_billing_profiles_clientId_idx" ON "client_billing_profiles" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "disclosure_acknowledgments_agreementId_idx" ON "disclosure_acknowledgments" USING btree ("agreement_id");--> statement-breakpoint
CREATE INDEX "invoices_clientId_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_invoiceNumber_idx" ON "invoices" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "message_attachments_messageId_idx" ON "message_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "message_threads_clientId_idx" ON "message_threads" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "message_threads_status_idx" ON "message_threads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "message_threads_lastMessageAt_idx" ON "message_threads" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "messages_threadId_idx" ON "messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "messages_senderId_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "messages_createdAt_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payment_audit_log_clientId_idx" ON "payment_audit_log" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "payment_audit_log_invoiceId_idx" ON "payment_audit_log" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payment_audit_log_createdAt_idx" ON "payment_audit_log" USING btree ("created_at");
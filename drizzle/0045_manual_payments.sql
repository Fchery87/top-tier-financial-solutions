CREATE TYPE "public"."invoice_payment_kind" AS ENUM('payment', 'refund');--> statement-breakpoint
CREATE TYPE "public"."invoice_payment_method" AS ENUM('zelle', 'check', 'cash', 'bank_ach', 'card_external', 'other');--> statement-breakpoint
CREATE TYPE "public"."sales_channel" AS ENUM('telemarketing', 'online', 'in_person');--> statement-breakpoint
CREATE TABLE "invoice_payments" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"client_id" text NOT NULL,
	"kind" "invoice_payment_kind" NOT NULL,
	"method" "invoice_payment_method" NOT NULL,
	"amount_cents" integer NOT NULL,
	"reference" text,
	"received_at" timestamp NOT NULL,
	"notes" text,
	"recorded_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_payments_amount_positive" CHECK ("invoice_payments"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "client_agreements" ADD COLUMN "fee_terms_snapshot" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "service_engagement_id" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "services_rendered_event_id" text;--> statement-breakpoint
ALTER TABLE "service_engagements" ADD COLUMN "sales_channel" "sales_channel";--> statement-breakpoint
ALTER TABLE "service_engagements" ADD COLUMN "service_period_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "service_engagements" ADD COLUMN "results_achieved_at" timestamp;--> statement-breakpoint
ALTER TABLE "service_engagements" ADD COLUMN "results_verification_report_id" text;--> statement-breakpoint
ALTER TABLE "service_engagements" ADD COLUMN "results_verification_report_date" timestamp;--> statement-breakpoint
ALTER TABLE "service_engagements" ADD COLUMN "results_verified_by_id" text;--> statement-breakpoint
ALTER TABLE "service_engagements" ADD COLUMN "results_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_payments_invoiceId_idx" ON "invoice_payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoice_payments_clientId_idx" ON "invoice_payments" USING btree ("client_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_service_engagement_id_service_engagements_id_fk" FOREIGN KEY ("service_engagement_id") REFERENCES "public"."service_engagements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_services_rendered_event_id_services_rendered_events_id_fk" FOREIGN KEY ("services_rendered_event_id") REFERENCES "public"."services_rendered_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_engagements" ADD CONSTRAINT "service_engagements_results_verification_report_id_credit_reports_id_fk" FOREIGN KEY ("results_verification_report_id") REFERENCES "public"."credit_reports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_engagements" ADD CONSTRAINT "service_engagements_results_verified_by_id_user_id_fk" FOREIGN KEY ("results_verified_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "compliance_gate_checks_engagement_check_key" ON "compliance_gate_checks" USING btree ("engagement_id","check_key");--> statement-breakpoint
CREATE INDEX "invoices_serviceEngagementId_idx" ON "invoices" USING btree ("service_engagement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_one_open_per_services_rendered_event" ON "invoices" USING btree ("services_rendered_event_id") WHERE "invoices"."services_rendered_event_id" IS NOT NULL AND "invoices"."status" <> 'void';
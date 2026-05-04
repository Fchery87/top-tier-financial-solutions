CREATE TYPE "public"."service_engagement_status" AS ENUM('active', 'closed', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."service_engagement_type" AS ENUM('credit_audit', 'credit_restoration');--> statement-breakpoint
CREATE TABLE "dispute_outcomes" (
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
CREATE TABLE "service_engagements" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"service_type" "service_engagement_type" NOT NULL,
	"status" "service_engagement_status" DEFAULT 'active' NOT NULL,
	"lifecycle_stage" text DEFAULT 'lead' NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"closure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "analysis_confidence" integer;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "auto_selected" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "response_channel" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "score_impact" integer;--> statement-breakpoint
ALTER TABLE "dispute_outcomes" ADD CONSTRAINT "dispute_outcomes_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_outcomes" ADD CONSTRAINT "dispute_outcomes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_outcomes" ADD CONSTRAINT "dispute_outcomes_next_dispute_id_disputes_id_fk" FOREIGN KEY ("next_dispute_id") REFERENCES "public"."disputes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_outcomes" ADD CONSTRAINT "dispute_outcomes_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_engagements" ADD CONSTRAINT "service_engagements_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispute_outcomes_disputeId_idx" ON "dispute_outcomes" USING btree ("dispute_id");--> statement-breakpoint
CREATE INDEX "dispute_outcomes_clientId_idx" ON "dispute_outcomes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "dispute_outcomes_outcome_idx" ON "dispute_outcomes" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "service_engagements_clientId_idx" ON "service_engagements" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "service_engagements_serviceType_idx" ON "service_engagements" USING btree ("service_type");--> statement-breakpoint
CREATE INDEX "service_engagements_status_idx" ON "service_engagements" USING btree ("status");
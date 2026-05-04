CREATE TABLE "dispute_cycles" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"service_engagement_id" text,
	"cycle_number" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"item_selection" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dispute_cycles" ADD CONSTRAINT "dispute_cycles_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_cycles" ADD CONSTRAINT "dispute_cycles_service_engagement_id_service_engagements_id_fk" FOREIGN KEY ("service_engagement_id") REFERENCES "public"."service_engagements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispute_cycles_clientId_idx" ON "dispute_cycles" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "dispute_cycles_serviceEngagementId_idx" ON "dispute_cycles" USING btree ("service_engagement_id");
CREATE TABLE "compliance_gate_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"engagement_id" text NOT NULL,
	"check_key" text NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compliance_gate_checks" ADD CONSTRAINT "compliance_gate_checks_engagement_id_service_engagements_id_fk" FOREIGN KEY ("engagement_id") REFERENCES "public"."service_engagements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compliance_gate_checks_engagementId_idx" ON "compliance_gate_checks" USING btree ("engagement_id");--> statement-breakpoint
CREATE INDEX "compliance_gate_checks_checkKey_idx" ON "compliance_gate_checks" USING btree ("check_key");
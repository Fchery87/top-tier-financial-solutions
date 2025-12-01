CREATE TABLE "audit_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"generated_by_id" text,
	"report_html" text NOT NULL,
	"score_transunion" integer,
	"score_experian" integer,
	"score_equifax" integer,
	"negative_items_count" integer DEFAULT 0,
	"total_debt" integer,
	"projected_score_increase" integer,
	"sent_via_email" boolean DEFAULT false,
	"email_sent_at" timestamp,
	"generated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "audit_reports" ADD CONSTRAINT "audit_reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_reports" ADD CONSTRAINT "audit_reports_generated_by_id_user_id_fk" FOREIGN KEY ("generated_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_reports_clientId_idx" ON "audit_reports" USING btree ("client_id");
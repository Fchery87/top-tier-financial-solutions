CREATE TABLE "dispute_letter_revisions" (
	"id" text PRIMARY KEY NOT NULL,
	"dispute_id" text NOT NULL,
	"revision" integer NOT NULL,
	"content" text NOT NULL,
	"source" text NOT NULL,
	"tone_label" text,
	"prompt_used" text,
	"lint_findings" text,
	"warnings_acknowledged" boolean DEFAULT false,
	"acknowledged_by" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "dispute_letter_revisions" ADD CONSTRAINT "dispute_letter_revisions_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_letter_revisions" ADD CONSTRAINT "dispute_letter_revisions_acknowledged_by_user_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_letter_revisions" ADD CONSTRAINT "dispute_letter_revisions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dispute_letter_revisions_disputeId_idx" ON "dispute_letter_revisions" USING btree ("dispute_id");
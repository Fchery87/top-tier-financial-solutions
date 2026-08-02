ALTER TABLE "dispute_letter_revisions" ADD COLUMN "generation_metadata" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "letter_context_snapshot" text;--> statement-breakpoint
CREATE UNIQUE INDEX "dispute_letter_revisions_dispute_revision_uidx" ON "dispute_letter_revisions" USING btree ("dispute_id","revision");
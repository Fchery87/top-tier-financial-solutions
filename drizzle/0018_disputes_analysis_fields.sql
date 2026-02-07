ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "analysis_confidence" integer;--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN IF NOT EXISTS "auto_selected" boolean DEFAULT false;

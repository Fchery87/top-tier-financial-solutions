ALTER TABLE "credit_reports" ADD COLUMN "parser_confidence" integer;--> statement-breakpoint
ALTER TABLE "credit_reports" ADD COLUMN "parser_review_status" text DEFAULT 'needs_review';
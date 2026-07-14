ALTER TABLE "credit_accounts" ADD COLUMN "completeness_score" integer;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD COLUMN "missing_fields" text[];

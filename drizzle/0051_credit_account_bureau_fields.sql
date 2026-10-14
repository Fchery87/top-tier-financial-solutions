ALTER TABLE "credit_accounts" ADD COLUMN "tradeline_key" text;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD COLUMN "original_creditor" text;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD COLUMN "date_of_first_delinquency" timestamp;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD COLUMN "bureau_stated_removal_date" timestamp;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD COLUMN "date_of_last_payment" timestamp;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD COLUMN "date_of_last_activity" timestamp;
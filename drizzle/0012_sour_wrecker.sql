ALTER TABLE "credit_accounts" ADD COLUMN "on_transunion" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD COLUMN "on_experian" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD COLUMN "on_equifax" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD COLUMN "transunion_date" timestamp;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD COLUMN "experian_date" timestamp;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD COLUMN "equifax_date" timestamp;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD COLUMN "transunion_balance" integer;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD COLUMN "experian_balance" integer;--> statement-breakpoint
ALTER TABLE "credit_accounts" ADD COLUMN "equifax_balance" integer;--> statement-breakpoint
ALTER TABLE "negative_items" ADD COLUMN "on_transunion" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "negative_items" ADD COLUMN "on_experian" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "negative_items" ADD COLUMN "on_equifax" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "negative_items" ADD COLUMN "transunion_date" timestamp;--> statement-breakpoint
ALTER TABLE "negative_items" ADD COLUMN "experian_date" timestamp;--> statement-breakpoint
ALTER TABLE "negative_items" ADD COLUMN "equifax_date" timestamp;--> statement-breakpoint
ALTER TABLE "negative_items" ADD COLUMN "transunion_status" text;--> statement-breakpoint
ALTER TABLE "negative_items" ADD COLUMN "experian_status" text;--> statement-breakpoint
ALTER TABLE "negative_items" ADD COLUMN "equifax_status" text;
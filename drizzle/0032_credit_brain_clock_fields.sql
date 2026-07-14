ALTER TABLE "negative_items" ADD COLUMN "date_of_first_delinquency" timestamp;--> statement-breakpoint
ALTER TABLE "negative_items" ADD COLUMN "bureau_stated_removal_date" timestamp;--> statement-breakpoint
ALTER TABLE "fcra_compliance_items" ADD COLUMN "dofd_confidence" text;

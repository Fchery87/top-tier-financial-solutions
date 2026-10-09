DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "invoice_payments" WHERE "method" = 'cash') THEN
    RAISE EXCEPTION 'invoice_payments has cash rows; the service agreement forbids cash, so review and re-classify them before removing the cash method';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "invoice_payments" ALTER COLUMN "method" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."invoice_payment_method";--> statement-breakpoint
CREATE TYPE "public"."invoice_payment_method" AS ENUM('zelle', 'check', 'bank_ach', 'card_external', 'other');--> statement-breakpoint
ALTER TABLE "invoice_payments" ALTER COLUMN "method" SET DATA TYPE "public"."invoice_payment_method" USING "method"::"public"."invoice_payment_method";
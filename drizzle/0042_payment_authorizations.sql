CREATE TYPE "public"."payment_authorization_account_type" AS ENUM('checking', 'savings');--> statement-breakpoint
CREATE TYPE "public"."payment_authorization_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TABLE "payment_authorizations" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"status" "payment_authorization_status" NOT NULL,
	"bank_name" text NOT NULL,
	"routing_number_encrypted" text NOT NULL,
	"account_number_encrypted" text NOT NULL,
	"routing_fingerprint" text,
	"account_fingerprint" text,
	"account_last4" text NOT NULL,
	"account_type" "payment_authorization_account_type" NOT NULL,
	"maximum_amount_cents" integer NOT NULL,
	"signature_data" text NOT NULL,
	"signed_at" timestamp NOT NULL,
	"signer_ip_address" text,
	"revoked_at" timestamp,
	"expires_at" timestamp,
	"superseded_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_authorizations" ADD CONSTRAINT "payment_authorizations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_authorizations_clientId_idx" ON "payment_authorizations" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_authorizations_one_active_per_client" ON "payment_authorizations" USING btree ("client_id") WHERE "payment_authorizations"."status" = 'active';
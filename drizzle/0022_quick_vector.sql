CREATE TABLE "evidence_packets" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"dispute_id" text,
	"claim_type" text NOT NULL,
	"document_ids" text DEFAULT '[]' NOT NULL,
	"confirmations" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence_packets" ADD CONSTRAINT "evidence_packets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_packets" ADD CONSTRAINT "evidence_packets_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidence_packets_clientId_idx" ON "evidence_packets" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "evidence_packets_disputeId_idx" ON "evidence_packets" USING btree ("dispute_id");
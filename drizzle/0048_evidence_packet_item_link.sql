CREATE TYPE "public"."evidence_packet_item_kind" AS ENUM('tradeline', 'personal', 'inquiry');--> statement-breakpoint
ALTER TABLE "evidence_packets" ADD COLUMN "item_kind" "evidence_packet_item_kind";--> statement-breakpoint
ALTER TABLE "evidence_packets" ADD COLUMN "item_id" text;--> statement-breakpoint
CREATE INDEX "evidence_packets_client_item_idx" ON "evidence_packets" USING btree ("client_id","item_kind","item_id");--> statement-breakpoint
ALTER TABLE "evidence_packets" ADD CONSTRAINT "evidence_packets_item_link_check" CHECK (("evidence_packets"."item_kind" IS NULL) = ("evidence_packets"."item_id" IS NULL));
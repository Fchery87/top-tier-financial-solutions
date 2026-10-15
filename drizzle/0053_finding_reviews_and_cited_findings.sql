CREATE TABLE "finding_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"negative_item_id" text NOT NULL,
	"finding_text" text NOT NULL,
	"decision" text NOT NULL,
	"decided_by_id" text,
	"decided_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "disputes" ADD COLUMN "cited_findings" text;--> statement-breakpoint
ALTER TABLE "finding_reviews" ADD CONSTRAINT "finding_reviews_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_reviews" ADD CONSTRAINT "finding_reviews_negative_item_id_negative_items_id_fk" FOREIGN KEY ("negative_item_id") REFERENCES "public"."negative_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_reviews" ADD CONSTRAINT "finding_reviews_decided_by_id_user_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finding_reviews_clientId_idx" ON "finding_reviews" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "finding_reviews_item_text_idx" ON "finding_reviews" USING btree ("negative_item_id","finding_text");
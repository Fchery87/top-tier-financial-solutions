ALTER TABLE "disputes" ADD COLUMN "response_document_id" text;--> statement-breakpoint
ALTER TABLE "evidence_packets" ADD COLUMN "created_by_id" text;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_response_document_id_client_documents_id_fk" FOREIGN KEY ("response_document_id") REFERENCES "public"."client_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_packets" ADD CONSTRAINT "evidence_packets_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "disputes_responseDocumentId_idx" ON "disputes" USING btree ("response_document_id");--> statement-breakpoint
CREATE INDEX "evidence_packets_createdById_idx" ON "evidence_packets" USING btree ("created_by_id");
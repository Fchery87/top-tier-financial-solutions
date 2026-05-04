CREATE TABLE "services_rendered_events" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"service_engagement_id" text,
	"event_type" text NOT NULL,
	"source_dispute_id" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"recorded_by_id" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "services_rendered_events" ADD CONSTRAINT "services_rendered_events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services_rendered_events" ADD CONSTRAINT "services_rendered_events_service_engagement_id_service_engagements_id_fk" FOREIGN KEY ("service_engagement_id") REFERENCES "public"."service_engagements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services_rendered_events" ADD CONSTRAINT "services_rendered_events_source_dispute_id_disputes_id_fk" FOREIGN KEY ("source_dispute_id") REFERENCES "public"."disputes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services_rendered_events" ADD CONSTRAINT "services_rendered_events_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "services_rendered_events_clientId_idx" ON "services_rendered_events" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "services_rendered_events_serviceEngagementId_idx" ON "services_rendered_events" USING btree ("service_engagement_id");--> statement-breakpoint
CREATE INDEX "services_rendered_events_eventType_idx" ON "services_rendered_events" USING btree ("event_type");
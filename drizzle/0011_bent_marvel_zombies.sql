CREATE TYPE "public"."llm_provider" AS ENUM('google', 'openai', 'anthropic', 'custom');--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text,
	"setting_type" text NOT NULL,
	"category" text DEFAULT 'general',
	"description" text,
	"is_secret" boolean DEFAULT false,
	"last_modified_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "system_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_last_modified_by_user_id_fk" FOREIGN KEY ("last_modified_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "system_settings_key_idx" ON "system_settings" USING btree ("setting_key");--> statement-breakpoint
CREATE INDEX "system_settings_category_idx" ON "system_settings" USING btree ("category");
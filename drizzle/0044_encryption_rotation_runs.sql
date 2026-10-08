CREATE TABLE "encryption_rotation_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"active_key_id" text NOT NULL,
	"status" text NOT NULL,
	"current_table" text,
	"checkpoint_id" text,
	"scanned_count" integer DEFAULT 0 NOT NULL,
	"rotated_count" integer DEFAULT 0 NOT NULL,
	"failure_class" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "encryption_rotation_runs_status_idx" ON "encryption_rotation_runs" USING btree ("status");
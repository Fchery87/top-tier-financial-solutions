CREATE TYPE "public"."client_stage" AS ENUM('lead', 'consultation', 'agreement', 'onboarding', 'active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."goal_type" AS ENUM('deletions', 'new_clients', 'disputes_sent', 'revenue');--> statement-breakpoint
CREATE TABLE "goals" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"month" text NOT NULL,
	"goal_type" "goal_type" NOT NULL,
	"target" integer NOT NULL,
	"current" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "stage" "client_stage" DEFAULT 'lead';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "assigned_to" text;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_userId_idx" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "goals_month_idx" ON "goals" USING btree ("month");--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_assigned_to_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_stage_idx" ON "clients" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "clients_assignedTo_idx" ON "clients" USING btree ("assigned_to");
CREATE TYPE "public"."consultationstatus" AS ENUM('new', 'contacted', 'qualified', 'archived');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'review', 'done');--> statement-breakpoint
CREATE TABLE "client_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"author_id" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"client_id" text,
	"assignee_id" text,
	"created_by_id" text,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'todo',
	"priority" "task_priority" DEFAULT 'medium',
	"due_date" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "consultation_requests" ALTER COLUMN "status" SET DEFAULT 'new'::"public"."consultationstatus";--> statement-breakpoint
ALTER TABLE "consultation_requests" ALTER COLUMN "status" SET DATA TYPE "public"."consultationstatus" USING "status"::"public"."consultationstatus";--> statement-breakpoint
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_notes" ADD CONSTRAINT "client_notes_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_notes_clientId_idx" ON "client_notes" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_notes_authorId_idx" ON "client_notes" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "tasks_clientId_idx" ON "tasks" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "tasks_assigneeId_idx" ON "tasks" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_dueDate_idx" ON "tasks" USING btree ("due_date");
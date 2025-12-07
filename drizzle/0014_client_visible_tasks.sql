ALTER TABLE "tasks" ADD COLUMN "visible_to_client" boolean DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN "is_blocking" boolean DEFAULT false;

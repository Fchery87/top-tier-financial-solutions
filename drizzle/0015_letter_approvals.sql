CREATE TABLE IF NOT EXISTS "letter_approvals" (
  "id" text PRIMARY KEY,
  "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "dispute_id" text REFERENCES "disputes"("id") ON DELETE CASCADE,
  "batch_id" text REFERENCES "dispute_batches"("id") ON DELETE SET NULL,
  "round" integer,
  "status" text DEFAULT 'pending',
  "approval_method" text,
  "signature_text" text,
  "signature_ip" text,
  "signature_user_agent" text,
  "approved_at" timestamp,
  "rejected_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "letter_approvals_clientId_idx" ON "letter_approvals" ("client_id");
CREATE INDEX IF NOT EXISTS "letter_approvals_disputeId_idx" ON "letter_approvals" ("dispute_id");
CREATE INDEX IF NOT EXISTS "letter_approvals_batchId_idx" ON "letter_approvals" ("batch_id");

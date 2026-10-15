-- ADR 0005: each credit_accounts row is one bureau's view of the account.
-- Parsers already store one row per bureau. A row with several bureau flags came
-- from the old backfill, which guessed every bureau for combined reports and copied
-- the same balance into each, so it is not split: it keeps a stored specific bureau
-- or becomes unknown. The per-bureau date columns are not carried over: they held
-- the reported date or, when it was missing, the opened date, so they are unreliable.
UPDATE "credit_accounts" SET
  bureau = CASE
    WHEN (COALESCE(on_transunion, false)::int + COALESCE(on_experian, false)::int + COALESCE(on_equifax, false)::int) = 1 AND on_transunion THEN 'transunion'
    WHEN (COALESCE(on_transunion, false)::int + COALESCE(on_experian, false)::int + COALESCE(on_equifax, false)::int) = 1 AND on_experian THEN 'experian'
    WHEN (COALESCE(on_transunion, false)::int + COALESCE(on_experian, false)::int + COALESCE(on_equifax, false)::int) = 1 AND on_equifax THEN 'equifax'
    WHEN bureau IN ('transunion', 'experian', 'equifax') THEN bureau
    ELSE NULL
  END,
  balance = CASE
    WHEN (COALESCE(on_transunion, false)::int + COALESCE(on_experian, false)::int + COALESCE(on_equifax, false)::int) = 1 AND on_transunion THEN COALESCE(transunion_balance, balance)
    WHEN (COALESCE(on_transunion, false)::int + COALESCE(on_experian, false)::int + COALESCE(on_equifax, false)::int) = 1 AND on_experian THEN COALESCE(experian_balance, balance)
    WHEN (COALESCE(on_transunion, false)::int + COALESCE(on_experian, false)::int + COALESCE(on_equifax, false)::int) = 1 AND on_equifax THEN COALESCE(equifax_balance, balance)
    ELSE balance
  END;--> statement-breakpoint
ALTER TABLE "credit_accounts" DROP COLUMN "on_transunion";--> statement-breakpoint
ALTER TABLE "credit_accounts" DROP COLUMN "on_experian";--> statement-breakpoint
ALTER TABLE "credit_accounts" DROP COLUMN "on_equifax";--> statement-breakpoint
ALTER TABLE "credit_accounts" DROP COLUMN "transunion_date";--> statement-breakpoint
ALTER TABLE "credit_accounts" DROP COLUMN "experian_date";--> statement-breakpoint
ALTER TABLE "credit_accounts" DROP COLUMN "equifax_date";--> statement-breakpoint
ALTER TABLE "credit_accounts" DROP COLUMN "transunion_balance";--> statement-breakpoint
ALTER TABLE "credit_accounts" DROP COLUMN "experian_balance";--> statement-breakpoint
ALTER TABLE "credit_accounts" DROP COLUMN "equifax_balance";
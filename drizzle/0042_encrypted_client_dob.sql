ALTER TABLE "clients"
  ALTER COLUMN "date_of_birth" SET DATA TYPE text
  USING CASE
    WHEN "date_of_birth" IS NULL THEN NULL
    ELSE to_char("date_of_birth", 'YYYY-MM-DD')
  END;

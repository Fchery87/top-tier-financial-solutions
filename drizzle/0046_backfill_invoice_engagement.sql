-- Before 0045 the invoice-to-engagement link lived only in the invoice_created audit row.
-- A regex read never throws on malformed JSON, so a bad audit row cannot fail the migration.
UPDATE "invoices" AS i
SET "service_engagement_id" = linked.engagement_id
FROM (
  SELECT DISTINCT ON (pal."invoice_id")
    pal."invoice_id",
    substring(pal."details" from '"service_engagement_id":"([^"]+)"') AS engagement_id
  FROM "payment_audit_log" AS pal
  WHERE pal."action" = 'invoice_created'
    AND pal."invoice_id" IS NOT NULL
    AND pal."details" IS NOT NULL
  ORDER BY pal."invoice_id", pal."created_at" DESC
) AS linked
WHERE i."id" = linked."invoice_id"
  AND i."service_engagement_id" IS NULL
  AND linked.engagement_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM "service_engagements" AS se WHERE se."id" = linked.engagement_id);

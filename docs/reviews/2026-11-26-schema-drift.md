# Schema drift: production vs. replayed migrations (2026-11-26)

Method: `scripts/schema-snapshot.sql` (structure only, one `READ ONLY` transaction) was run against production and against an empty Postgres after a strict replay of all 54 journaled migrations (CI artifact `replayed-schema`). No data and no writes.

Bookkeeping is in sync: production has 54 rows in `drizzle.__drizzle_migrations` and its latest timestamp equals the journal's last entry.

## Equivalent (noise)
- All 185 constraints match by definition. 53 foreign keys differ only by name (`*_fkey` in production, `*_fk` in the replay).
- 16 indexes differ only by name casing (production lowercase, replay camelCase, e.g. `tasks_clientid_idx` vs `tasks_clientId_idx`). Same columns.
- All 20 enums match.

## Real differences
1. **Fixed 2026-11-26: four indexes were missing in production** and were created with `CREATE INDEX CONCURRENTLY IF NOT EXISTS` (all valid and ready afterwards) (they exist in the journal and `db/schema.ts`): `disputes_escalationReadyAt_idx`, `bureau_discrepancies_type_idx`, `fcra_compliance_items_expiration_idx`, `email_send_log_triggerType_idx`. Performance only; nothing breaks without them.
2. **`admin_users` exists only in production** (8 columns, primary key, unique-email index). Not in `db/schema.ts` and not referenced in `src/`. A leftover from before the journal.
3. **`clients.lead_id` is `uuid` in production, `text` in the replay and in `db/schema.ts`.** It references `consultation_requests.id`, which is also `uuid` in production. Fine while ids are UUIDs; a non-UUID id would fail on production only.
4. **Legacy public-site tables** (`pages`, `services`, `faq_items`, `testimonials`, `disclaimers`, `consultation_requests`) have a different shape in production: `uuid` ids and `varchar(n)` instead of `text`, `NOT NULL` without `DEFAULT`s (the schema has defaults and nullable columns), plus extra `ix_*` indexes. This is the pre-journal origin of those tables; the app works against it today.

## Suggested follow-ups (each needs your approval before touching production)
- Decide whether `admin_users` should be dropped (check it is empty first).
- Either align `db/schema.ts` to the production types for the legacy tables, or migrate production to match. Not urgent.

## Update (2026-11-26, later)
- The legacy-table differences (items 3 and 4) were resolved by aligning `db/schema.ts` to production and adding the guarded, idempotent migration `0054_align_legacy_tables` (#31). It was applied to production with `db:migrate`: production now has 55 applied migrations, and its schema was byte-identical before and after (the migration was a no-op there, as designed).
- A replay of all 55 migrations now matches production in every table, column, constraint and index, ignoring foreign-key names and index-name casing. The one remaining difference is `admin_users`.
- `admin_users` was **not** dropped: it holds 1 row (an active legacy admin account from 2025-11-30 with no matching user in the app's auth table). Dropping needs your decision; back the row up first.

## Update: admin_users dropped
- `admin_users` was dropped from production on 2026-11-26 after backing up its single row (plus a restore script with the table definition) to a private folder outside the repo. Nothing referenced it (no foreign keys, views or triggers; not used in `src/`).
- Production's schema now matches a full replay of the journal, ignoring foreign-key names and index-name casing.

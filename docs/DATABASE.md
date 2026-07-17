# Database & Migrations

> Updated: 2026-07-16

The application database is **Neon PostgreSQL**, accessed through **Drizzle ORM**. The schema lives in `db/schema.ts`; generated SQL migrations live in `drizzle/` with journal metadata in `drizzle/meta/_journal.json`.

## The workflow

Schema changes follow one path:

```bash
# 1. Edit db/schema.ts
# 2. Generate a migration from the schema diff
npm run db:generate
# 3. Apply pending migrations to the database
npm run db:migrate
```

`db:migrate` is idempotent — it applies only journal entries newer than the last row in `drizzle.__drizzle_migrations` and records each one it runs.

## ⚠️ Never run `db:push` / `drizzle-kit push --force`

`drizzle-kit push` diffs `db/schema.ts` directly against the live database and applies the difference. On this project that is **destructive**, for two reasons:

1. **`admin_users` is not dead.** It is intentionally absent from `db/schema.ts` because it belongs to the optional FastAPI service (`api/models.py` → `AdminUser`, used by `api/auth.py` for authentication). Push proposes `DROP TABLE "admin_users" CASCADE`, which would destroy FastAPI auth. With `--force` it would do so without asking.
2. **Cosmetic constraint-name churn.** Part of the schema history was hand-applied SQL, so many constraints carry Postgres default names (`*_fkey`, `*_key`) instead of Drizzle's generated names (`*_fk`, `*_unique`). Push wants to drop and recreate all of them. They are functionally identical — this diff noise is expected and safe to ignore.

If you need to inspect drift, run `npx drizzle-kit push` interactively, read the proposed statements, and answer **no**.

## Migration history repair (July 2026)

The database sat 17 migrations behind the repo (nothing after Dec 2025 had been applied) because `drizzle-kit migrate` failed silently on an internally inconsistent history:

- `0019_dispute_outcomes` was hand-written and hand-applied; the auto-generated `0020` then re-created the same table, so the migrator crashed on its first pending file.
- `0035` packs multiple SQL commands into a single statement block, which Neon's HTTP driver rejects (`cannot insert multiple commands into a prepared statement`).
- `0036` duplicates `0034`/`0035` and carries an out-of-order journal timestamp.

The repair applied `0020`–`0036` statement-by-statement (skipping only already-exists collisions — every pending migration was additive) and backfilled the `drizzle.__drizzle_migrations` bookkeeping. The history is now consistent (journal count == applied count) and `npm run db:migrate` works normally going forward.

### `scripts/repair-drizzle-migrations.mjs`

Marks journal entries as applied **without running their SQL** (`--through=<tag>`, supports `--dry-run`). Use it only when the database already contains a migration's objects (e.g. hand-applied SQL) and the bookkeeping needs to catch up. It does not execute DDL.

## Writing migrations — rules of thumb

- Always create migrations with `db:generate`; avoid hand-written migration files. If one is unavoidable, put **one SQL command per `--> statement-breakpoint` block** (Neon's HTTP driver cannot batch commands).
- Never hand-apply SQL to the database without also recording it (that's how the 2026 drift started).
- Prefer small, additive schema changes over broad rewrites.
- After merging, run `npm run db:migrate` against each environment's `DATABASE_URL`.

## Related storage: Cloudflare R2

Document files (credit reports, dispute evidence, response proofs) are stored in Cloudflare R2 (bucket `top-tier-financial-solutions`) via the S3-compatible client in `src/lib/r2-storage.ts`. R2 has no migration concept — configuration is entirely the four `R2_*` environment variables. If uploads fail, verify credentials with a simple round trip (HeadBucket → Put → signed Get → Delete) before suspecting application code.

# Deploy

The live app is the Next.js process. The database is Neon Postgres. Files are in Cloudflare R2. The FastAPI process under `api/` is not part of this deploy.

## Platform

Pin production to one Vercel project and one Neon database.

- Production tracks `main`.
- Staging is a second Vercel environment pointed at a separate Neon branch. Do not point staging at the production database.
- `NEXT_PUBLIC_APP_URL` on each environment is that environment's own URL.
- Set `CRON_SECRET`, `ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, `DATABASE_URL`, and the R2 and AI keys in the Vercel environment. Do not commit them.

## Release

1. `npm run validate` on the commit you intend to ship.
2. Apply pending Drizzle migrations to the staging database and smoke sign-in, a client read, and a letter read.
3. Promote that same commit to production. Apply the same migrations to the production database before the new deployment serves traffic.
4. Do not run `npm run db:push` against production. Generate a migration and apply that file.

## Rollback

Vercel keeps the previous deployment. If the new deployment fails sign-in or a client read, promote the previous deployment from the Vercel dashboard.

Roll back the deployment before you consider rolling back a migration. A migration that already wrote data is not safe to reverse from the dashboard. Restore the Neon branch for that database instead, then redeploy the matching commit.

## Cron checks

These two routes reject any request whose `Authorization` header is not `Bearer $CRON_SECRET`.

- `POST /api/cron/dispute-escalations`
- `POST /api/cron/nudge-stalled-clients`

Schedule both from Vercel cron or an external scheduler. A missed run is a failed check. Confirm each route returned 200 in the last interval after a production deploy. The escalation route also writes its failure into the last-run setting when the job throws.

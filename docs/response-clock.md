## Response Clock Escalation Script

### Purpose
Auto-escalates disputes whose `escalationReadyAt` is in the past by setting `status` to `escalated` and appending an entry to `escalationHistory`.

### Script Location
`scripts/response-clock.ts`

### Run Manually
```bash
npx tsx scripts/response-clock.ts
```

### Suggested Scheduling
- Cron (example): `*/30 * * * * cd /path/to/repo && npx tsx scripts/response-clock.ts >> /var/log/response-clock.log 2>&1`
- Kubernetes/CronJob: run the same command in the app image on a 30–60 minute cadence.

### Behavior
- Selects disputes where `status` is `sent` or `in_progress` **and** `escalationReadyAt <= now()`.
- Updates each to `status='escalated'`, sets `updatedAt`, and pushes `{ escalatedAt, fromStatus }` into `escalationHistory`.
- Logs totals to stdout.

### Prerequisites
- DB connectivity (uses project `db` client and `disputes` table fields `escalationReadyAt`, `escalationHistory`).
- Node/tsx available (installed via repo dependencies).

### Operational Notes
- Run after disputes are marked `sent` so `escalationReadyAt` is set.
- Safe to re-run; already-escalated disputes are skipped because their status no longer matches `sent`/`in_progress`.

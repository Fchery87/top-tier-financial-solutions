// Replays every journaled migration, in order, against an EMPTY database and
// fails on the first error. Used by CI to prove the history is replayable.
// Usage: PGHOST=... PGUSER=... PGPASSWORD=... PGDATABASE=... node scripts/replay-migrations.mjs
// Requires the `psql` client. Never point this at a database that holds data.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const dir = join(process.cwd(), 'drizzle');
const journal = JSON.parse(readFileSync(join(dir, 'meta', '_journal.json'), 'utf8'));

for (const { tag } of journal.entries) {
  const result = spawnSync(
    'psql',
    ['-v', 'ON_ERROR_STOP=1', '-q', '-f', join(dir, `${tag}.sql`)],
    { stdio: ['ignore', 'inherit', 'inherit'], env: process.env },
  );
  if (result.status !== 0) {
    console.error(`\nMigration ${tag} failed to apply on an empty database.`);
    process.exit(1);
  }
}
console.log(`Replayed ${journal.entries.length} migrations cleanly.`);

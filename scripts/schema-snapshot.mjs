// Read-only schema snapshot of the database in DATABASE_URL, written to a file.
// Runs inside a READ ONLY transaction; prints nothing sensitive.
// Usage: node scripts/schema-snapshot.mjs <out.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const out = process.argv[2];
if (!out || !process.env.DATABASE_URL) {
  console.error('Usage: DATABASE_URL=... node scripts/schema-snapshot.mjs <out.json>');
  process.exit(1);
}
const sql = readFileSync(new URL('./schema-snapshot.sql', import.meta.url), 'utf8');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN READ ONLY');
  const { rows } = await client.query(sql);
  await client.query('ROLLBACK');
  writeFileSync(out, JSON.stringify(rows[0].snapshot, null, 1));
  console.log('Snapshot written to', out);
} finally {
  client.release();
  await pool.end();
}

import { config } from 'dotenv';
import { sql } from 'drizzle-orm';

import { buildDeprecatedLetterTableAudit } from '../src/lib/deprecated-letter-table-audit';

config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });

function countFromRows(rows: unknown[]): number {
  const first = rows[0];
  if (!first || typeof first !== 'object' || !('count' in first)) return 0;
  return Number(first.count || 0);
}

function booleanFromRows(rows: unknown[]): boolean {
  const first = rows[0];
  if (!first || typeof first !== 'object' || !('exists' in first)) return false;
  return first.exists === true || first.exists === 'true';
}

export async function auditDeprecatedLetterTemplates() {
  const { db } = await import('../db/client');
  const tableResult = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'dispute_letter_templates'
    ) AS exists
  `);

  if (!booleanFromRows(tableResult.rows)) {
    return buildDeprecatedLetterTableAudit({
      deprecatedRows: 0,
      activeDeprecatedRows: 0,
      activeLibraryRows: 0,
    });
  }

  const [deprecatedResult, activeDeprecatedResult, activeLibraryResult] = await Promise.all([
    db.execute(sql`SELECT count(*)::int AS count FROM dispute_letter_templates`),
    db.execute(sql`SELECT count(*)::int AS count FROM dispute_letter_templates WHERE is_active = true`),
    db.execute(sql`SELECT count(*)::int AS count FROM dispute_letter_library WHERE is_active = true`),
  ]);

  return buildDeprecatedLetterTableAudit({
    deprecatedRows: countFromRows(deprecatedResult.rows),
    activeDeprecatedRows: countFromRows(activeDeprecatedResult.rows),
    activeLibraryRows: countFromRows(activeLibraryResult.rows),
  });
}

auditDeprecatedLetterTemplates()
  .then((audit) => {
    console.log(JSON.stringify({
      generatedAt: new Date().toISOString(),
      ...audit,
      policy: 'Retain the deprecated table for compatibility; use dispute_letter_library for all new work.',
    }, null, 2));
  })
  .catch((error) => {
    console.error('Deprecated letter table audit failed:', error);
    process.exitCode = 1;
  });

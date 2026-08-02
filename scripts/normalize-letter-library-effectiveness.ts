import 'dotenv/config';
import { and, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { db } from '../db/client';
import { disputeLetterLibrary } from '../db/schema';

const shouldApply = process.argv.includes('--apply');

async function main() {
  const condition = and(
    isNotNull(disputeLetterLibrary.effectivenessRating),
    or(
      isNull(disputeLetterLibrary.timesUsed),
      lt(disputeLetterLibrary.timesUsed, 10),
    ),
  );

  if (!shouldApply) {
    const rows = await db
      .select({ id: disputeLetterLibrary.id, name: disputeLetterLibrary.name })
      .from(disputeLetterLibrary)
      .where(condition);
    console.log(JSON.stringify({ mode: 'dry-run', rows: rows.length, ids: rows.map(row => row.id) }, null, 2));
    return;
  }

  const result = await db
    .update(disputeLetterLibrary)
    .set({ effectivenessRating: null, updatedAt: new Date() })
    .where(condition);

  console.log(JSON.stringify({ mode: 'apply', rowsUpdated: result.rowCount ?? null }, null, 2));
}

main().catch(error => {
  console.error('Letter library effectiveness normalization failed:', error);
  process.exitCode = 1;
});

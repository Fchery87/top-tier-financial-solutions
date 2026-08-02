import 'dotenv/config';
import { and, eq, ilike, isNotNull, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/client';
import { disputeLetterLibrary, disputeLetterTemplates } from '../db/schema';
import { getAllMethodologies } from '../src/lib/dispute-config-loader';

type CountRow = { count: number | string };
type AuditTable = typeof disputeLetterLibrary | typeof disputeLetterTemplates;

function countValue(row: CountRow | undefined): number {
  return Number(row?.count || 0);
}

async function countRows(table: AuditTable, condition?: SQL<unknown>): Promise<number> {
  const query = db.select({ count: sql<number>`count(*)` }).from(table);
  const [row] = condition ? await query.where(condition) : await query;
  return countValue(row);
}

async function main() {
  const [libraryCount, activeLibraryCount, templateCount, placeholderCount, promptContextCount, citationCount] = await Promise.all([
    countRows(disputeLetterLibrary),
    countRows(disputeLetterLibrary, eq(disputeLetterLibrary.isActive, true)),
    countRows(disputeLetterTemplates),
    countRows(disputeLetterTemplates, ilike(disputeLetterTemplates.content, '%Check dispute_letter_library%')),
    countRows(
      disputeLetterLibrary,
      and(isNotNull(disputeLetterLibrary.promptContext), sql`btrim(${disputeLetterLibrary.promptContext}) <> ''`),
    ),
    countRows(disputeLetterLibrary, isNotNull(disputeLetterLibrary.legalCitations)),
  ]);

  const distinctCombinations = await db
    .select({
      methodology: disputeLetterLibrary.methodology,
      targetRecipient: disputeLetterLibrary.targetRecipient,
      round: disputeLetterLibrary.round,
      isActive: disputeLetterLibrary.isActive,
    })
    .from(disputeLetterLibrary)
    .groupBy(
      disputeLetterLibrary.methodology,
      disputeLetterLibrary.targetRecipient,
      disputeLetterLibrary.round,
      disputeLetterLibrary.isActive,
    )
    .orderBy(
      disputeLetterLibrary.methodology,
      disputeLetterLibrary.targetRecipient,
      disputeLetterLibrary.round,
    );

  const effectivenessAnomalies = await db
    .select({
      id: disputeLetterLibrary.id,
      name: disputeLetterLibrary.name,
      timesUsed: disputeLetterLibrary.timesUsed,
      effectivenessRating: disputeLetterLibrary.effectivenessRating,
    })
    .from(disputeLetterLibrary)
    .where(
      and(
        isNotNull(disputeLetterLibrary.effectivenessRating),
        sql`coalesce(${disputeLetterLibrary.timesUsed}, 0) < 10`,
      ),
    );

  const methodologies = getAllMethodologies();
  const coverageGaps: Array<{ methodology: string; targetRecipient: string; round: number }> = [];
  for (const [methodology, definition] of Object.entries(methodologies)) {
    for (const round of definition.round_range) {
      for (const targetRecipient of definition.target_recipients) {
        const [match] = await db
          .select({ id: disputeLetterLibrary.id })
          .from(disputeLetterLibrary)
          .where(
            and(
              eq(disputeLetterLibrary.methodology, methodology),
              eq(disputeLetterLibrary.targetRecipient, targetRecipient),
              eq(disputeLetterLibrary.round, round),
              eq(disputeLetterLibrary.isActive, true),
            ),
          )
          .limit(1);
        if (!match) coverageGaps.push({ methodology, targetRecipient, round });
      }
    }
  }

  const duplicateSignatures = await db
    .select({
      name: disputeLetterLibrary.name,
      content: disputeLetterLibrary.content,
      count: sql<number>`count(*)`,
    })
    .from(disputeLetterLibrary)
    .groupBy(disputeLetterLibrary.name, disputeLetterLibrary.content)
    .having(sql`count(*) > 1`);

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    tables: {
      disputeLetterLibrary: { total: libraryCount, active: activeLibraryCount },
      disputeLetterTemplates: { total: templateCount, placeholderRows: placeholderCount },
    },
    enrichment: {
      promptContextRows: promptContextCount,
      legalCitationRows: citationCount,
    },
    distinctCombinations,
    duplicateSignatures: duplicateSignatures.map(row => ({
      name: row.name,
      duplicateCount: Number(row.count),
    })),
    effectivenessAnomalies,
    coverageGaps,
    decisionGate: {
      requiresCanonicalSeederDecision: duplicateSignatures.length > 0,
      requiresEffectivenessNormalization: effectivenessAnomalies.length > 0,
      blockedUntilResolved: duplicateSignatures.length > 0,
    },
  }, null, 2));
}

main().catch(error => {
  console.error('Letter library audit failed:', error);
  process.exitCode = 1;
});

import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { negativeItems } from '@/db/schema';
import { loadItemCrossBureauFindings } from '@/lib/cross-bureau-loader';
import { loadTimelineFindings } from '@/lib/item-timeline-loader';
import type { TimelineFindingKind } from '@/lib/item-timeline';
import type { SpecificBureau } from '@/lib/tradeline-matching';

/** A Finding worded for one bureau's letter. */
export interface LetterFinding {
  tier: 'objective' | 'interpretive';
  reasonCode: string;
  text: string;
}

const TIMELINE_REASON_CODES: Record<TimelineFindingKind, string> = {
  reaged: 'reaged_account',
  reinserted: 'reinserted_item',
  changed_after_verification: 'changed_after_verification',
  missing_dispute_flag: 'missing_dispute_flag',
};

const SPECIFIC_BUREAUS = ['transunion', 'experian', 'equifax'];

/** Cross-bureau and Item Timeline findings for the negative items a letter to one bureau covers. */
export async function loadLetterFindings(input: { clientId: string; negativeItemIds: string[]; bureau: string }): Promise<LetterFinding[]> {
  if (input.negativeItemIds.length === 0 || !SPECIFIC_BUREAUS.includes(input.bureau)) return [];
  const bureau = input.bureau as SpecificBureau;
  const items = await db
    .select({ id: negativeItems.id, creditReportId: negativeItems.creditReportId, creditAccountId: negativeItems.creditAccountId })
    .from(negativeItems)
    .where(and(eq(negativeItems.clientId, input.clientId), inArray(negativeItems.id, input.negativeItemIds)));

  const findings: LetterFinding[] = [];
  const crossBureau = [...new Set([...(await loadItemCrossBureauFindings(input.clientId, items)).values()].flat())];
  for (const finding of crossBureau) {
    const text = finding.letterText[bureau];
    if (text) findings.push({ tier: finding.tier, reasonCode: finding.field === 'date_of_first_delinquency' ? 'dofd_cross_bureau_mismatch' : 'cross_bureau_mismatch', text });
  }

  for (const reportId of new Set(items.map(item => item.creditReportId))) {
    const accountIds = items.filter(item => item.creditReportId === reportId && item.creditAccountId).map(item => item.creditAccountId as string);
    if (accountIds.length === 0) continue;
    for (const finding of await loadTimelineFindings(input.clientId, reportId)) {
      if (finding.bureau === bureau && finding.accountIds.some(id => accountIds.includes(id))) {
        findings.push({ tier: finding.tier, reasonCode: TIMELINE_REASON_CODES[finding.kind], text: finding.text });
      }
    }
  }
  return findings;
}

/**
 * Adds the objective findings to a letter's reasons. Interpretive findings wait for
 * staff review and never enter a letter here.
 */
export function applyLetterFindings(
  findings: LetterFinding[],
  letter: { reasonCodes: string[]; metro2Violations?: string[] },
): { reasonCodes: string[]; metro2Violations?: string[] } {
  const objective = findings.filter(item => item.tier === 'objective');
  if (objective.length === 0) return letter;
  return {
    reasonCodes: [...new Set([...letter.reasonCodes, ...objective.map(item => item.reasonCode)])],
    metro2Violations: [...new Set([...(letter.metro2Violations ?? []), ...objective.map(item => item.text)])],
  };
}

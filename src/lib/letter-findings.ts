import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { creditAccounts, findingReviews, negativeItems } from '@/db/schema';
import { loadItemCrossBureauFindings } from '@/lib/cross-bureau-loader';
import { loadTimelineFindings } from '@/lib/item-timeline-loader';
import type { TimelineFindingKind } from '@/lib/item-timeline';
import { checkSingleTradeline, type SingleTradelineFinding } from '@/lib/single-tradeline-checks';
import type { SpecificBureau } from '@/lib/tradeline-matching';

/** A Finding about one negative item, worded for one bureau's letter. */
export interface ItemFinding {
  itemId: string;
  bureau: SpecificBureau;
  tier: 'objective' | 'interpretive';
  reasonCode: string;
  text: string;
  /** Staff decision on an Interpretive Finding; objective findings need none. */
  review: 'approved' | 'dropped' | null;
}

export type LetterFinding = Pick<ItemFinding, 'tier' | 'reasonCode' | 'text' | 'review'>;

const TIMELINE_REASON_CODES: Record<TimelineFindingKind, string> = {
  reaged: 'reaged_account',
  reinserted: 'reinserted_item',
  changed_after_verification: 'changed_after_verification',
  missing_dispute_flag: 'missing_dispute_flag',
};

const SINGLE_TRADELINE_REASON_CODES: Record<SingleTradelineFinding['code'], string> = {
  impossible_dates: 'wrong_dates',
  scheduled_payment_after_chargeoff: 'metro2_violation',
  lates_after_chargeoff: 'status_inconsistency',
  balance_after_bankruptcy: 'balance_discrepancy',
  balance_after_transfer: 'balance_discrepancy',
};

const SPECIFIC_BUREAUS: SpecificBureau[] = ['transunion', 'experian', 'equifax'];

function parseGrid(raw: string | null, bureau: string): Record<string, string> | null {
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as Record<string, Record<string, string>>)[bureau] ?? null;
  } catch {
    return null;
  }
}

/** Every Finding the server can decide for these negative items, from their stored tradelines. */
export async function collectItemFindings(clientId: string, itemIds: string[]): Promise<ItemFinding[]> {
  if (itemIds.length === 0) return [];
  const items = await db
    .select({ id: negativeItems.id, creditReportId: negativeItems.creditReportId, creditAccountId: negativeItems.creditAccountId })
    .from(negativeItems)
    .where(and(eq(negativeItems.clientId, clientId), inArray(negativeItems.id, itemIds)));
  const linked = items.filter(item => item.creditAccountId);
  if (linked.length === 0) return [];

  const findings: Array<Omit<ItemFinding, 'review'>> = [];

  for (const [itemId, itemFindings] of await loadItemCrossBureauFindings(clientId, items)) {
    for (const finding of itemFindings) {
      for (const bureau of SPECIFIC_BUREAUS) {
        const text = finding.letterText[bureau];
        if (text) findings.push({ itemId, bureau, tier: finding.tier, reasonCode: finding.field === 'date_of_first_delinquency' ? 'dofd_cross_bureau_mismatch' : 'cross_bureau_mismatch', text });
      }
    }
  }

  for (const reportId of new Set(linked.map(item => item.creditReportId))) {
    const timeline = await loadTimelineFindings(clientId, reportId);
    for (const item of linked.filter(candidate => candidate.creditReportId === reportId)) {
      for (const finding of timeline.filter(candidate => candidate.accountIds.includes(item.creditAccountId as string))) {
        findings.push({ itemId: item.id, bureau: finding.bureau, tier: finding.tier, reasonCode: TIMELINE_REASON_CODES[finding.kind], text: finding.text });
      }
    }
  }

  // Each bureau's own tradeline row: the linked row, plus rows of the same tradeline on other bureaus.
  const linkedRows = await db.select().from(creditAccounts).where(inArray(creditAccounts.id, linked.map(item => item.creditAccountId as string)));
  const keys = linkedRows.map(row => row.tradelineKey).filter((key): key is string => !!key);
  const siblings = keys.length > 0 ? await db.select().from(creditAccounts).where(inArray(creditAccounts.tradelineKey, keys)) : [];
  for (const item of linked) {
    const own = linkedRows.find(row => row.id === item.creditAccountId);
    if (!own) continue;
    const rows = own.tradelineKey ? siblings.filter(row => row.tradelineKey === own.tradelineKey) : [own];
    for (const row of rows) {
      if (!row.bureau || !SPECIFIC_BUREAUS.includes(row.bureau as SpecificBureau)) continue;
      for (const finding of checkSingleTradeline({
        accountStatus: row.accountStatus,
        paymentStatus: row.paymentStatus,
        balance: row.balance,
        pastDueAmount: row.pastDueAmount,
        monthlyPayment: row.monthlyPayment,
        dateOpened: row.dateOpened?.toISOString() ?? null,
        dateReported: row.dateReported?.toISOString() ?? null,
        dateOfFirstDelinquency: row.dateOfFirstDelinquency?.toISOString() ?? null,
        dateOfLastPayment: row.dateOfLastPayment?.toISOString() ?? null,
        remarks: row.remarks,
        paymentHistory: parseGrid(row.paymentHistoryGrid, row.bureau),
      })) {
        findings.push({ itemId: item.id, bureau: row.bureau as SpecificBureau, tier: finding.tier, reasonCode: SINGLE_TRADELINE_REASON_CODES[finding.code], text: finding.text });
      }
    }
  }

  const reviews = await db
    .select({ negativeItemId: findingReviews.negativeItemId, findingText: findingReviews.findingText, decision: findingReviews.decision })
    .from(findingReviews)
    .where(and(eq(findingReviews.clientId, clientId), inArray(findingReviews.negativeItemId, itemIds)));
  const decisionFor = (itemId: string, text: string) => {
    const decision = reviews.find(review => review.negativeItemId === itemId && review.findingText === text)?.decision;
    return decision === 'approved' || decision === 'dropped' ? decision : null;
  };

  const seen = new Set<string>();
  return findings.flatMap(finding => {
    const key = `${finding.itemId}|${finding.bureau}|${finding.text}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ...finding, review: finding.tier === 'interpretive' ? decisionFor(finding.itemId, finding.text) : null }];
  });
}

/** The Findings a letter to one bureau can carry for the negative items it covers. */
export async function loadLetterFindings(input: { clientId: string; negativeItemIds: string[]; bureau: string }): Promise<LetterFinding[]> {
  if (!SPECIFIC_BUREAUS.includes(input.bureau as SpecificBureau)) return [];
  return (await collectItemFindings(input.clientId, input.negativeItemIds))
    .filter(finding => finding.bureau === input.bureau)
    .map(({ tier, reasonCode, text, review }) => ({ tier, reasonCode, text, review }));
}

/** Objective findings, and Interpretive Findings staff approved, are what a letter may cite. */
export function isCitable(finding: Pick<ItemFinding, 'tier' | 'review'>): boolean {
  return finding.tier === 'objective' || finding.review === 'approved';
}

/** Adds the citable findings to a letter's reasons. */
export function applyLetterFindings(
  findings: LetterFinding[],
  letter: { reasonCodes: string[]; metro2Violations?: string[] },
): { reasonCodes: string[]; metro2Violations?: string[] } {
  const citable = findings.filter(isCitable);
  if (citable.length === 0) return letter;
  return {
    reasonCodes: [...new Set([...letter.reasonCodes, ...citable.map(item => item.reasonCode)])],
    metro2Violations: [...new Set([...(letter.metro2Violations ?? []), ...citable.map(item => item.text)])],
  };
}

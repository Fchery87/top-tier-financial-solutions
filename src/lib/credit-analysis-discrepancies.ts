import { bureauDiscrepancies } from '@/db/schema';
import { randomUUID } from 'crypto';
import { findCrossBureauMismatches, type CrossBureauField, type CrossBureauRow } from '@/lib/cross-bureau-findings';
import type { TimelineFinding } from '@/lib/item-timeline';

const DISCREPANCY_TYPES: Record<CrossBureauField, string> = {
  date_of_first_delinquency: 'date_mismatch',
  removal_date: 'date_mismatch',
  date_opened: 'date_mismatch',
  date_of_last_payment: 'date_mismatch',
  balance: 'account_balance',
  past_due: 'account_balance',
  credit_limit: 'account_balance',
  high_credit: 'account_balance',
  status: 'account_status',
  payment_history: 'payment_history',
  original_creditor: 'account_field',
  dispute_flag: 'account_field',
};

const BUREAU_NAMES = { transunion: 'TransUnion', experian: 'Experian', equifax: 'Equifax' } as const;

/**
 * Stores each Cross-Bureau Mismatch for review. Severity stays medium or low: a
 * high-severity discrepancy blocks letter generation, and these findings belong in letters.
 */
export function buildCrossBureauDiscrepancies(
  clientId: string,
  creditReportId: string,
  rows: CrossBureauRow[],
): Array<typeof bureauDiscrepancies.$inferInsert> {
  return findCrossBureauMismatches(rows).map(finding => {
    const anyRow = rows.find(row => finding.accountIds.includes(row.id));
    const disputeWith = (Object.keys(finding.letterText) as Array<keyof typeof BUREAU_NAMES>).map(bureau => BUREAU_NAMES[bureau]);
    return {
      id: randomUUID(),
      clientId,
      creditReportId,
      discrepancyType: DISCREPANCY_TYPES[finding.field],
      field: finding.field,
      creditorName: anyRow?.creditorName ?? null,
      accountNumber: anyRow?.accountNumber ?? null,
      valueTransunion: finding.values.transunion ?? null,
      valueExperian: finding.values.experian ?? null,
      valueEquifax: finding.values.equifax ?? null,
      severity: finding.tier === 'objective' ? 'medium' : 'low',
      isDisputable: true,
      disputeRecommendation: `${finding.tier === 'objective' ? 'Objective' : 'Interpretive (staff review before use)'} cross-bureau mismatch. Dispute with ${disputeWith.join(', ')}.`,
      createdAt: new Date(),
    };
  });
}

const TIMELINE_LABELS: Record<TimelineFinding['kind'], string> = {
  reaged: 'date of first delinquency moved later',
  reinserted: 'deleted item reappeared',
  changed_after_verification: 'changed after a Verified response',
  missing_dispute_flag: 'not marked as disputed while still disputed',
};

/** Stores each Item Timeline finding for review against the bureau it happened on. */
export function buildTimelineDiscrepancies(
  clientId: string,
  creditReportId: string,
  findings: TimelineFinding[],
): Array<typeof bureauDiscrepancies.$inferInsert> {
  return findings.map(finding => ({
    id: randomUUID(),
    clientId,
    creditReportId,
    discrepancyType: `timeline_${finding.kind}`,
    field: finding.kind,
    creditorName: finding.creditorName,
    accountNumber: null,
    valueTransunion: finding.bureau === 'transunion' ? TIMELINE_LABELS[finding.kind] : null,
    valueExperian: finding.bureau === 'experian' ? TIMELINE_LABELS[finding.kind] : null,
    valueEquifax: finding.bureau === 'equifax' ? TIMELINE_LABELS[finding.kind] : null,
    severity: finding.tier === 'objective' ? 'medium' : 'low',
    isDisputable: true,
    disputeRecommendation: `${finding.tier === 'objective' ? 'Objective' : 'Interpretive (staff review before use)'} Item Timeline finding. ${finding.text}`,
    createdAt: new Date(),
  }));
}

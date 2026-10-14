import { bureauDiscrepancies } from '@/db/schema';
import { randomUUID } from 'crypto';
import { findCrossBureauMismatches, type CrossBureauField, type CrossBureauRow } from '@/lib/cross-bureau-findings';

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

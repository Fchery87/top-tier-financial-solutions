import type { ParsedAccount } from '@/lib/parsers/pdf-parser';
import { getAccountBureaus } from '@/lib/credit-account-bureau-presence';

export interface StoredTradelineRow {
  id: string;
  bureau: string | null;
  creditorName: string;
  accountNumber: string | null;
}

export interface TradelineBackfillUpdate {
  id: string;
  set: {
    bureau?: string;
    tradelineKey?: string;
    dateReported?: Date;
    originalCreditor?: string;
    dateOfFirstDelinquency?: Date;
    bureauStatedRemovalDate?: Date;
    dateOfLastPayment?: Date;
    dateOfLastActivity?: Date;
  };
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Fills the per-bureau fields of rows saved before ADR 0005 from a fresh parse of
 * the same report. A row is updated only when exactly one parsed tradeline matches
 * its creditor, account number and bureau; anything ambiguous is left alone.
 */
export function planTradelineBackfill(input: {
  reportId: string;
  reportBureau: string | null;
  rows: StoredTradelineRow[];
  parsedAccounts: ParsedAccount[];
}): TradelineBackfillUpdate[] {
  const parsed = input.parsedAccounts.flatMap(account =>
    getAccountBureaus(account, input.reportBureau).map(bureau => ({
      account,
      bureau,
      accountNumber: (bureau ? account.bureauEvidence?.[bureau]?.accountNumber : undefined) ?? account.accountNumber,
    })));

  return input.rows.flatMap(row => {
    const matches = parsed.filter(candidate =>
      normalize(candidate.account.creditorName) === normalize(row.creditorName)
      && normalize(candidate.accountNumber) === normalize(row.accountNumber)
      && (row.bureau === null || candidate.bureau === row.bureau));
    if (matches.length !== 1) return [];

    const { account, bureau } = matches[0];
    const evidence = bureau ? account.bureauEvidence?.[bureau] : undefined;
    const set: TradelineBackfillUpdate['set'] = {
      bureau: row.bureau === null && bureau ? bureau : undefined,
      tradelineKey: account.tradelineGroup ? `${input.reportId}:${account.tradelineGroup}` : undefined,
      dateReported: evidence?.dateReported ?? account.dateReported,
      originalCreditor: account.originalCreditor,
      dateOfFirstDelinquency: account.dateOfFirstDelinquency,
      bureauStatedRemovalDate: account.bureauStatedRemovalDate,
      dateOfLastPayment: account.dateOfLastPayment,
      dateOfLastActivity: account.dateOfLastActivity,
    };
    const defined = Object.fromEntries(Object.entries(set).filter(([, value]) => value !== undefined));
    return Object.keys(defined).length > 0 ? [{ id: row.id, set: defined }] : [];
  });
}

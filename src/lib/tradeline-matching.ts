export type SpecificBureau = 'transunion' | 'experian' | 'equifax';

export interface BureauTradeline {
  bureau: string | null;
  tradelineKey: string | null;
  creditorName: string;
  accountNumber: string | null;
  dateOpened: Date | null;
}

const SPECIFIC_BUREAUS: readonly string[] = ['transunion', 'experian', 'equifax'];

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function normalizeCreditor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * The account a row belongs to. A combined report's own grouping wins. Otherwise
 * the last four visible digits plus the month opened, or the creditor plus the
 * month opened when the number is fully masked. No month opened, no match.
 */
export function tradelineMatchKey(row: BureauTradeline): string | null {
  if (row.tradelineKey) return `key:${row.tradelineKey}`;
  if (!row.dateOpened || Number.isNaN(row.dateOpened.getTime())) return null;
  const digits = (row.accountNumber ?? '').replace(/\D/g, '');
  const opened = monthKey(row.dateOpened);
  return digits.length >= 4
    ? `digits:${digits.slice(-4)}|${opened}`
    : `creditor:${normalizeCreditor(row.creditorName)}|${opened}`;
}

/**
 * Groups rows that are the same account on different bureaus. A group with two
 * rows from one bureau is ambiguous and dropped, so a bad match never produces a
 * Cross-Bureau Mismatch.
 */
export function groupAcrossBureaus<T extends BureauTradeline>(rows: T[]): Array<Map<SpecificBureau, T>> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.bureau || !SPECIFIC_BUREAUS.includes(row.bureau)) continue;
    const key = tradelineMatchKey(row);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const result: Array<Map<SpecificBureau, T>> = [];
  for (const group of groups.values()) {
    const byBureau = new Map<SpecificBureau, T>();
    let ambiguous = false;
    for (const row of group) {
      const bureau = row.bureau as SpecificBureau;
      if (byBureau.has(bureau)) ambiguous = true;
      byBureau.set(bureau, row);
    }
    if (!ambiguous && byBureau.size >= 2) result.push(byBureau);
  }
  return result;
}

import { groupAcrossBureaus, type BureauTradeline, type SpecificBureau } from '@/lib/tradeline-matching';

/** One bureau's stored view of an account, as the cross-bureau checks read it. */
export interface CrossBureauRow extends BureauTradeline {
  id: string;
  dateReported: Date | null;
  accountStatus: string | null;
  paymentStatus: string | null;
  balance: number | null;
  pastDueAmount: number | null;
  creditLimit: number | null;
  highCredit: number | null;
  originalCreditor: string | null;
  dateOfFirstDelinquency: Date | null;
  bureauStatedRemovalDate: Date | null;
  dateOfLastPayment: Date | null;
  remarks: string | null;
  paymentHistoryGrid: string | null;
}

export type CrossBureauField =
  | 'date_of_first_delinquency'
  | 'removal_date'
  | 'date_opened'
  | 'original_creditor'
  | 'date_of_last_payment'
  | 'balance'
  | 'past_due'
  | 'status'
  | 'credit_limit'
  | 'high_credit'
  | 'dispute_flag'
  | 'payment_history';

export interface CrossBureauFinding {
  field: CrossBureauField;
  tier: 'objective' | 'interpretive';
  /** Every stored row in the matched group, so a negative item linked to any of them finds it. */
  accountIds: string[];
  values: Partial<Record<SpecificBureau, string>>;
  /** The bureaus a letter should dispute this with, each with its own wording. */
  letterText: Partial<Record<SpecificBureau, string>>;
}

const BUREAU_NAMES: Record<SpecificBureau, string> = {
  transunion: 'TransUnion',
  experian: 'Experian',
  equifax: 'Equifax',
};

const FIELD_LABELS: Record<CrossBureauField, string> = {
  date_of_first_delinquency: 'date of first delinquency',
  removal_date: 'date this account is scheduled to be removed',
  date_opened: 'date opened',
  original_creditor: 'original creditor',
  date_of_last_payment: 'date of last payment',
  balance: 'balance',
  past_due: 'past-due amount',
  status: 'account status',
  credit_limit: 'credit limit',
  high_credit: 'high credit',
  dispute_flag: 'dispute notation',
  payment_history: 'payment history',
};

type Group = Map<SpecificBureau, CrossBureauRow>;
type Value = { bureau: SpecificBureau; display: string; compare: string };

function monthOf(date: Date | null): string | null {
  return date && !Number.isNaN(date.getTime())
    ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    : null;
}

function displayMonth(date: Date): string {
  return `${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function listBureaus(bureaus: SpecificBureau[]): string {
  const names = bureaus.map(bureau => BUREAU_NAMES[bureau]);
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Current-state values can differ only because bureaus updated in different months. */
function sameReportingMonth(group: Group, bureaus: SpecificBureau[]): boolean {
  const months = bureaus.map(bureau => monthOf(group.get(bureau)?.dateReported ?? null));
  return months.every(month => month !== null) && new Set(months).size === 1;
}

const CLOSED_HISTORY = /charge|collection|closed|paid|transfer|sold/i;

function statusClass(row: CrossBureauRow): string | null {
  const text = `${row.paymentStatus ?? ''} ${row.accountStatus ?? ''}`.toLowerCase();
  if (/collection/.test(text)) return 'collection';
  if (/charge/.test(text)) return 'charge-off';
  if (/(30|60|90|120|150|180)_?days?_?late|late|delinquent|derogatory/.test(text)) return 'late';
  if (/paid|closed/.test(text)) return 'paid or closed';
  if (/current|open|pays as agreed|ok/.test(text)) return 'current';
  return null;
}

function finding(
  field: CrossBureauField,
  tier: CrossBureauFinding['tier'],
  group: Group,
  values: Value[],
  disputeBureaus: SpecificBureau[],
  sentence: (bureau: SpecificBureau, own: Value, others: Value[]) => string,
): CrossBureauFinding {
  const letterText: CrossBureauFinding['letterText'] = {};
  for (const bureau of disputeBureaus) {
    const own = values.find(value => value.bureau === bureau);
    if (own) letterText[bureau] = sentence(bureau, own, values.filter(value => value.compare !== own.compare));
  }
  return {
    field,
    tier,
    accountIds: [...group.values()].map(row => row.id),
    values: Object.fromEntries(values.map(value => [value.bureau, value.display])),
    letterText,
  };
}

function othersSay(others: Value[]): string {
  const byDisplay = new Map<string, SpecificBureau[]>();
  for (const other of others) byDisplay.set(other.display, [...(byDisplay.get(other.display) ?? []), other.bureau]);
  return [...byDisplay.entries()].map(([display, bureaus]) => `${listBureaus(bureaus)} ${bureaus.length > 1 ? 'report' : 'reports'} ${display}`).join(', and ');
}

function contradiction(field: CrossBureauField) {
  return (_bureau: SpecificBureau, own: Value, others: Value[]) =>
    `You report the ${FIELD_LABELS[field]} of this account as ${own.display}, but ${othersSay(others)}. These cannot all be accurate.`;
}

function differs(values: Value[]): boolean {
  return values.length >= 2 && new Set(values.map(value => value.compare)).size > 1;
}

function monthIndex(compare: string): number {
  const [year, month] = compare.split('-').map(Number);
  return year * 12 + month;
}

/** Bureaus print some dates a month apart by convention, so only a wider gap is a contradiction. */
function differsByMoreThanAMonth(values: Value[]): boolean {
  const months = values.map(value => monthIndex(value.compare));
  return values.length >= 2 && Math.max(...months) - Math.min(...months) > 1;
}

function dateValues(group: Group, pick: (row: CrossBureauRow) => Date | null): Value[] {
  return [...group.entries()].flatMap(([bureau, row]) => {
    const date = pick(row);
    const month = monthOf(date);
    return date && month ? [{ bureau, display: displayMonth(date), compare: month }] : [];
  });
}

function amountValues(group: Group, pick: (row: CrossBureauRow) => number | null, ignoreZero = false): Value[] {
  return [...group.entries()].flatMap(([bureau, row]) => {
    const amount = pick(row);
    if (amount === null || (ignoreZero && amount === 0)) return [];
    return [{ bureau, display: money(amount), compare: String(amount) }];
  });
}

/** A later date makes the account look newer, so only the bureaus reporting a later month are disputed. */
function laterThanEarliest(values: Value[]): SpecificBureau[] {
  const earliest = values.map(value => value.compare).sort()[0];
  return values.filter(value => value.compare > earliest).map(value => value.bureau);
}

function laterDateSentence(field: CrossBureauField, reason: string) {
  return (_bureau: SpecificBureau, own: Value, others: Value[]) => {
    const earliest = [...others].sort((a, b) => a.compare.localeCompare(b.compare));
    const firstOthers = earliest.filter(value => value.compare === earliest[0].compare);
    return `You report the ${FIELD_LABELS[field]} of this account as ${own.display}, but ${listBureaus(firstOthers.map(value => value.bureau))} ${firstOthers.length > 1 ? 'report' : 'reports'} ${firstOthers[0].display}. ${reason}`;
  };
}

function parseGrid(raw: string | null, bureau: SpecificBureau): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, Record<string, string>>;
    return parsed?.[bureau] ?? {};
  } catch {
    return {};
  }
}

const LATE_CODES = new Set(['30', '60', '90', '120', '150', '180', 'CO', 'COL']);

function paymentHistoryFindings(group: Group): CrossBureauFinding[] {
  const grids = [...group.entries()].map(([bureau, row]) => ({ bureau, grid: parseGrid(row.paymentHistoryGrid, bureau) }));
  const findings: CrossBureauFinding[] = [];

  // Month-keyed grids: the same month cannot be both late and on time.
  const months = new Set(grids.flatMap(({ grid }) => Object.keys(grid).filter(key => /^\d{4}-\d{2}$/.test(key))));
  for (const month of [...months].sort()) {
    const values: Value[] = grids.flatMap(({ bureau, grid }) => grid[month] ? [{ bureau, display: grid[month] === 'OK' ? 'on time' : `${grid[month]}`, compare: grid[month] }] : []);
    const late = values.filter(value => LATE_CODES.has(value.compare));
    if (late.length > 0 && values.some(value => value.compare === 'OK')) {
      const [year, monthNumber] = month.split('-');
      findings.push(finding('payment_history', 'objective', group, values, late.map(value => value.bureau),
        (_bureau, own, others) => `You report ${Number(monthNumber)}/${year} on this account as ${own.display}, but ${othersSay(others)} for the same month. These cannot all be accurate.`));
    }
  }

  // Late-count summaries can differ when a bureau holds less history, so they are interpretive.
  const summaries = grids.filter(({ grid }) => Object.keys(grid).some(key => !/^\d{4}-\d{2}$/.test(key)));
  const lateCounts = summaries.map(({ bureau, grid }) => {
    const counts = ['30', '60', '90', '120', '150', '180'].map(code => [code, Number(grid[code] ?? 0)] as const);
    const total = counts.reduce((sum, [, count]) => sum + count, 0);
    const display = total === 0 ? 'no late payments' : counts.filter(([, count]) => count > 0).map(([code, count]) => `${count} at ${code} days`).join(', ');
    return { bureau, display, compare: counts.map(([, count]) => count).join('/'), total };
  });
  if (differs(lateCounts)) {
    const most = Math.max(...lateCounts.map(value => value.total));
    findings.push(finding('payment_history', 'interpretive', group, lateCounts,
      lateCounts.filter(value => value.total === most).map(value => value.bureau),
      (_bureau, own, others) => `You report ${own.display} on this account, but ${othersSay(others)}. These cannot all be accurate.`));
  }
  return findings;
}

function groupFindings(group: Group): CrossBureauFinding[] {
  const findings: CrossBureauFinding[] = [];
  const allBureaus = (values: Value[]) => values.map(value => value.bureau);
  const historical = [...group.values()].every(row => CLOSED_HISTORY.test(`${row.accountStatus ?? ''} ${row.paymentStatus ?? ''}`));

  const dofd = dateValues(group, row => row.dateOfFirstDelinquency);
  if (differs(dofd)) {
    findings.push(finding('date_of_first_delinquency', 'objective', group, dofd, laterThanEarliest(dofd),
      laterDateSentence('date_of_first_delinquency', 'A later date makes this account look newer than it is and extends how long it can be reported. Only one date can be accurate.')));
  }

  const removal = dateValues(group, row => row.bureauStatedRemovalDate);
  if (differs(removal)) {
    findings.push(finding('removal_date', 'objective', group, removal, laterThanEarliest(removal),
      laterDateSentence('removal_date', 'A later removal date keeps this account on my report longer than the other bureaus will. Only one date can be accurate.')));
  }

  const opened = dateValues(group, row => row.dateOpened);
  if (differsByMoreThanAMonth(opened)) findings.push(finding('date_opened', 'objective', group, opened, allBureaus(opened), contradiction('date_opened')));

  const originalCreditor: Value[] = [...group.entries()].flatMap(([bureau, row]) => row.originalCreditor
    ? [{ bureau, display: row.originalCreditor, compare: row.originalCreditor.toLowerCase().replace(/[^a-z0-9]/g, '') }]
    : []);
  if (differs(originalCreditor)) findings.push(finding('original_creditor', 'objective', group, originalCreditor, allBureaus(originalCreditor), contradiction('original_creditor')));

  const lastPayment = dateValues(group, row => row.dateOfLastPayment);
  if (differsByMoreThanAMonth(lastPayment) && (historical || sameReportingMonth(group, allBureaus(lastPayment)))) {
    findings.push(finding('date_of_last_payment', 'objective', group, lastPayment, allBureaus(lastPayment), contradiction('date_of_last_payment')));
  }

  const currentState: Array<[CrossBureauField, Value[], CrossBureauFinding['tier']]> = [
    ['balance', amountValues(group, row => row.balance), 'objective'],
    ['past_due', amountValues(group, row => row.pastDueAmount), 'objective'],
    ['credit_limit', amountValues(group, row => row.creditLimit, true), 'objective'],
    ['high_credit', amountValues(group, row => row.highCredit, true), 'interpretive'],
  ];
  const statuses: Value[] = [...group.entries()].flatMap(([bureau, row]) => {
    const status = statusClass(row);
    return status ? [{ bureau, display: status, compare: status }] : [];
  });
  currentState.push(['status', statuses, 'objective']);
  for (const [field, values, tier] of currentState) {
    if (differs(values) && sameReportingMonth(group, allBureaus(values))) {
      findings.push(finding(field, tier, group, values, allBureaus(values), contradiction(field)));
    }
  }

  // A furnisher must tell every bureau it reports to that the account is disputed.
  const flags: Value[] = [...group.entries()].map(([bureau, row]) => {
    const disputed = /disput/i.test(row.remarks ?? '');
    return { bureau, display: disputed ? 'marked as disputed' : 'not marked as disputed', compare: String(disputed) };
  });
  if (differs(flags) && sameReportingMonth(group, allBureaus(flags))) {
    findings.push(finding('dispute_flag', 'objective', group, flags, flags.filter(flag => flag.compare === 'false').map(flag => flag.bureau),
      (_bureau, _own, others) => `This account is not marked as disputed on your report, but ${listBureaus(others.map(value => value.bureau))} ${others.length > 1 ? 'show' : 'shows'} it as disputed by me. The reporting is incomplete without the dispute notation.`));
  }

  findings.push(...paymentHistoryFindings(group));
  return findings;
}

/** Every Cross-Bureau Mismatch among comparable rows. Rows that cannot be matched with confidence are never compared. */
export function findCrossBureauMismatches(rows: CrossBureauRow[]): CrossBureauFinding[] {
  return groupAcrossBureaus(rows).flatMap(groupFindings);
}

/**
 * Adds the objective findings for one bureau to a letter's reasons. Interpretive
 * findings wait for staff review and never enter a letter here.
 */
export function applyCrossBureauFindings(
  findings: CrossBureauFinding[],
  letter: { reasonCodes: string[]; metro2Violations?: string[] },
): { reasonCodes: string[]; metro2Violations?: string[] } {
  const objective = findings.filter(item => item.tier === 'objective');
  if (objective.length === 0) return letter;
  const sentences = objective.flatMap(item => Object.values(item.letterText));
  const codes = ['cross_bureau_mismatch', ...(objective.some(item => item.field === 'date_of_first_delinquency') ? ['dofd_cross_bureau_mismatch'] : [])];
  return {
    reasonCodes: [...new Set([...letter.reasonCodes, ...codes])],
    metro2Violations: [...new Set([...(letter.metro2Violations ?? []), ...sentences])],
  };
}

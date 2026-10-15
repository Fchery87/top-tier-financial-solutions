/** Contradictions inside one bureau's view of one account. */

export interface SingleTradelineInput {
  accountStatus?: string | null;
  paymentStatus?: string | null;
  /** Cents. */
  balance?: number | null;
  pastDueAmount?: number | null;
  monthlyPayment?: number | null;
  dateOpened?: string | null;
  dateReported?: string | null;
  dateOfFirstDelinquency?: string | null;
  dateOfLastPayment?: string | null;
  remarks?: string | null;
  /** One bureau's month-keyed grid (YYYY-MM -> code). Late-count summaries are ignored. */
  paymentHistory?: Record<string, string> | null;
}

export interface SingleTradelineFinding {
  code: 'impossible_dates' | 'scheduled_payment_after_chargeoff' | 'lates_after_chargeoff' | 'balance_after_bankruptcy' | 'balance_after_transfer';
  tier: 'objective' | 'interpretive';
  text: string;
}

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthIndex(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function display(date: Date): string {
  return `${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`;
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

const CLOSED_OUT = /charge|collection|closed|paid|transfer|sold/i;
const BANKRUPTCY = /bankrupt|chapter\s*(7|11|13)/i;
const TRANSFERRED = /\b(sold|transferred|transfer)\b/i;
const LATE_CODES = new Set(['30', '60', '90', '120', '150', '180']);
const CHARGE_OFF_CODES = new Set(['CO', 'COL', 'L', 'G']);

export function checkSingleTradeline(input: SingleTradelineInput): SingleTradelineFinding[] {
  const findings: SingleTradelineFinding[] = [];
  const opened = parse(input.dateOpened);
  const reported = parse(input.dateReported);
  const dofd = parse(input.dateOfFirstDelinquency);
  const lastPayment = parse(input.dateOfLastPayment);
  const status = `${input.accountStatus ?? ''} ${input.paymentStatus ?? ''}`;
  const remarks = input.remarks ?? '';
  const balance = input.balance ?? 0;
  const pastDue = input.pastDueAmount ?? 0;

  // Compared by month, so a bureau printing the first of the month never trips these.
  const before = (earlier: Date | null, later: Date | null) => earlier !== null && later !== null && monthIndex(earlier) < monthIndex(later);
  if (before(dofd, opened)) {
    findings.push({ code: 'impossible_dates', tier: 'objective', text: `The date of first delinquency (${display(dofd!)}) is earlier than the date the account was opened (${display(opened!)}). An account cannot become delinquent before it exists.` });
  }
  if (before(lastPayment, opened)) {
    findings.push({ code: 'impossible_dates', tier: 'objective', text: `The date of last payment (${display(lastPayment!)}) is earlier than the date the account was opened (${display(opened!)}). A payment cannot be made on an account before it exists.` });
  }
  if (before(reported, opened)) {
    findings.push({ code: 'impossible_dates', tier: 'objective', text: `The account is reported as opened in ${display(opened!)}, after the date of this report (${display(reported!)}).` });
  }
  if (before(reported, dofd)) {
    findings.push({ code: 'impossible_dates', tier: 'objective', text: `The date of first delinquency (${display(dofd!)}) is later than the date of this report (${display(reported!)}).` });
  }

  if ((input.monthlyPayment ?? 0) > 0 && CLOSED_OUT.test(status)) {
    findings.push({ code: 'scheduled_payment_after_chargeoff', tier: 'interpretive', text: `The account is reported as ${input.accountStatus ?? input.paymentStatus} but still shows a scheduled monthly payment of ${money(input.monthlyPayment!)}. A closed or charged-off account has no scheduled payment.` });
  }

  const months = Object.keys(input.paymentHistory ?? {}).filter(key => /^\d{4}-\d{2}$/.test(key)).sort();
  const chargeOffMonth = months.find(month => CHARGE_OFF_CODES.has(String(input.paymentHistory![month]).toUpperCase()));
  if (chargeOffMonth) {
    const later = months.filter(month => month > chargeOffMonth && LATE_CODES.has(String(input.paymentHistory![month])));
    if (later.length > 0) {
      findings.push({ code: 'lates_after_chargeoff', tier: 'interpretive', text: `The payment history shows the account charged off or in collection in ${chargeOffMonth}, then reports new late payments afterward (${later.join(', ')}). After a charge-off the history should keep showing the charge-off, not new lates.` });
    }
  }

  if (BANKRUPTCY.test(`${status} ${remarks}`) && (balance > 0 || pastDue > 0)) {
    findings.push({ code: 'balance_after_bankruptcy', tier: 'objective', text: `The account is reported as included in bankruptcy but still shows ${balance > 0 ? `a balance of ${money(balance)}` : ''}${balance > 0 && pastDue > 0 ? ' and ' : ''}${pastDue > 0 ? `a past-due amount of ${money(pastDue)}` : ''}. An account included in bankruptcy should report no balance owed.` });
  }

  if (TRANSFERRED.test(remarks) && !/collection/i.test(status) && (balance > 0 || pastDue > 0)) {
    findings.push({ code: 'balance_after_transfer', tier: 'objective', text: `The account is reported as sold or transferred but still shows a balance of ${money(Math.max(balance, pastDue))}. Once an account is transferred, the original creditor no longer holds the debt and should report no balance.` });
  }

  return findings;
}

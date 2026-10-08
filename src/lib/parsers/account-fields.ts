import type { ParsedAccount } from './pdf-parser';
import { parseMonthDayYearDate, parseMonthYearDate, parseReportDate } from './report-date';

export type ExtractedAccountFields = Pick<
  ParsedAccount,
  'originalCreditor' | 'dateOfFirstDelinquency' | 'bureauStatedRemovalDate'
>;

const ORIGINAL_CREDITOR =
  /(?:^|[\n\r])\s*Original\s+Creditor(?:\s+Name)?\s*:\s*([^\n\r(]+)/i;

const PARENTHETICAL_ORIGINAL_CREDITOR =
  /\(\s*Original\s+Creditor(?:\s+Name)?\s*:\s*([^)]+?)\s*\)/i;

const DATE_OF_FIRST_DELINQUENCY =
  /(?:Date\s+of\s+First\s+Delinquency|DOFD)\s*:?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{1,2}[\/-]\d{4})/i;

const BUREAU_STATED_REMOVAL =
  /(?:Estimated\s+date\s+of\s+removal|On\s+record\s+until|Scheduled\s+to\s+remain\s+until)\s*:?\s*(\d{1,2}[\/-]\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i;

function cleanOriginalCreditor(value: string): string | undefined {
  const cleaned = value.replace(/^\d+\s+/, '').replace(/\s+/g, ' ').trim();
  return cleaned || undefined;
}

function parseLabeledDate(value: string): Date | undefined {
  return parseMonthDayYearDate(value) || parseMonthYearDate(value) || parseReportDate(value);
}

/**
 * Reads only labels that are present in one account's raw text.
 * Missing labels stay off the result instead of becoming empty strings.
 * IdentityIQ's payment-history grid is a late-count summary built from HTML
 * classes, not a month grid this text can prove, so it is never set here.
 */
export function extractAccountFields(rawText: string | undefined | null): ExtractedAccountFields {
  if (!rawText) return {};

  const fields: ExtractedAccountFields = {};

  const labeledCreditor = rawText.match(ORIGINAL_CREDITOR);
  const parentheticalCreditor = labeledCreditor ? null : rawText.match(PARENTHETICAL_ORIGINAL_CREDITOR);
  const originalCreditor = cleanOriginalCreditor(
    labeledCreditor?.[1] ?? parentheticalCreditor?.[1] ?? '',
  );
  if (originalCreditor) fields.originalCreditor = originalCreditor;

  const delinquency = rawText.match(DATE_OF_FIRST_DELINQUENCY);
  const dateOfFirstDelinquency = delinquency ? parseLabeledDate(delinquency[1]) : undefined;
  if (dateOfFirstDelinquency) fields.dateOfFirstDelinquency = dateOfFirstDelinquency;

  const removal = rawText.match(BUREAU_STATED_REMOVAL);
  const bureauStatedRemovalDate = removal ? parseLabeledDate(removal[1]) : undefined;
  if (bureauStatedRemovalDate) fields.bureauStatedRemovalDate = bureauStatedRemovalDate;

  return fields;
}

export function creditorNameWithoutOriginalCreditor(creditorName: string): string {
  const stripped = creditorName
    .replace(PARENTHETICAL_ORIGINAL_CREDITOR, '')
    .replace(ORIGINAL_CREDITOR, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || creditorName.trim();
}

export function applyExtractedAccountFields(
  account: ParsedAccount,
  rawText: string | undefined | null,
): void {
  const fields = extractAccountFields(rawText);
  if (!account.originalCreditor && fields.originalCreditor) {
    account.originalCreditor = fields.originalCreditor;
    account.creditorName = creditorNameWithoutOriginalCreditor(account.creditorName);
  }
  if (!account.dateOfFirstDelinquency && fields.dateOfFirstDelinquency) {
    account.dateOfFirstDelinquency = fields.dateOfFirstDelinquency;
  }
  if (!account.bureauStatedRemovalDate && fields.bureauStatedRemovalDate) {
    account.bureauStatedRemovalDate = fields.bureauStatedRemovalDate;
  }
}

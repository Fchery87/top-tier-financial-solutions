/**
 * The one place letter dates are formatted.
 *
 * Stored calendar dates (date-only strings, or timestamps at UTC midnight)
 * are formatted in UTC so the calendar day never shifts with the server's
 * zone. The letter's own date is the business date in New York, where the
 * company operates; there is no time-zone setting to read it from.
 */
export const BUSINESS_TIME_ZONE = 'America/New_York';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function toDate(value: string | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const trimmed = value.trim();
  const dateOnly = trimmed.match(DATE_ONLY);
  const usDate = trimmed.match(US_DATE);
  const parsed = dateOnly
    ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])))
    : usDate
      ? new Date(Date.UTC(Number(usDate[3]), Number(usDate[1]) - 1, Number(usDate[2])))
      : new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** A stored calendar date as M/D/YYYY, e.g. '2026-05-01' -> '5/1/2026'. Unparseable input is returned as given. */
export function formatCalendarDate(value: string | Date): string {
  const date = toDate(value);
  if (!date) return String(value);
  return date.toLocaleDateString('en-US', { timeZone: 'UTC' });
}

/** A date of birth as MM/DD/YYYY, e.g. '1985-03-07' -> '03/07/1985'. Unparseable input is returned trimmed. */
export function formatDateOfBirth(value: string): string {
  const date = toDate(value);
  if (!date) return value.trim();
  return date.toLocaleDateString('en-US', { timeZone: 'UTC', month: '2-digit', day: '2-digit', year: 'numeric' });
}

/** The date printed on a letter: the New York business date of `now`, e.g. 'October 8, 2026'. */
export function formatLetterDate(now: Date = new Date()): string {
  return now.toLocaleDateString('en-US', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

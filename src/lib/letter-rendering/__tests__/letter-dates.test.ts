import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BUSINESS_TIME_ZONE, formatCalendarDate, formatLetterDate } from '@/lib/letter-rendering/letter-dates';

// Run in a zone west of UTC, where formatting a UTC-midnight date in the
// local zone lands on the previous day.
const originalTimeZone = process.env.TZ;
beforeAll(() => { process.env.TZ = 'America/Los_Angeles'; });
afterAll(() => { process.env.TZ = originalTimeZone; });

describe('formatCalendarDate', () => {
  it('keeps the calendar day of a date-only string', () => {
    expect(formatCalendarDate('2026-05-01')).toBe('5/1/2026');
  });

  it('keeps the calendar day of a stored calendar date at UTC midnight', () => {
    expect(formatCalendarDate(new Date('2026-05-01T00:00:00Z'))).toBe('5/1/2026');
    expect(formatCalendarDate('2026-05-01T00:00:00.000Z')).toBe('5/1/2026');
  });
});

describe('formatLetterDate', () => {
  it('uses the New York business date, not the server date', () => {
    expect(BUSINESS_TIME_ZONE).toBe('America/New_York');
    expect(formatLetterDate(new Date('2026-10-09T02:30:00Z'))).toBe('October 8, 2026');
  });
});

import { describe, expect, it } from 'vitest';
import { parseMonthYearDate, parseReportDate, parseYearDate } from '@/lib/parsers/report-date';

describe('report-date parsing', () => {
  it('parses month/day/year deterministically in UTC', () => {
    expect(parseReportDate('02/20/2021')?.toISOString()).toBe('2021-02-20T00:00:00.000Z');
    expect(parseReportDate('2-5-24')?.toISOString()).toBe('2024-02-05T00:00:00.000Z');
  });

  it('parses month/year when explicitly allowed', () => {
    expect(parseReportDate('03/2025', { allowMonthYear: true })?.toISOString()).toBe('2025-03-01T00:00:00.000Z');
    expect(parseMonthYearDate('11-2026')?.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('parses year-only when explicitly allowed', () => {
    expect(parseReportDate('2020', { allowYearOnly: true })?.toISOString()).toBe('2020-01-01T00:00:00.000Z');
    expect(parseYearDate('1999')?.toISOString()).toBe('1999-01-01T00:00:00.000Z');
  });

  it('rejects invalid or ambiguous input', () => {
    expect(parseReportDate('')).toBeUndefined();
    expect(parseReportDate('-')).toBeUndefined();
    expect(parseReportDate('13/40/2024')).toBeUndefined();
    expect(parseReportDate('03/2025')).toBeUndefined();
    expect(parseReportDate('2025')).toBeUndefined();
  });
});

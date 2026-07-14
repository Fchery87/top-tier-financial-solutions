import { describe, expect, it } from 'vitest';
import {
  buildFcraComplianceStatus,
  getObsolescenceBaseDate,
  getObsolescenceClock,
} from '@/lib/fcra-clock';

describe('fcra clock helpers', () => {
  it('prefers bureau stated removal date over all computed proxies', () => {
    const clock = getObsolescenceClock({
      bureauStatedRemovalDate: '2030-04-01',
      dateOfFirstDelinquency: '2018-01-01',
      dateOfLastActivity: '2019-01-01',
      dateReported: '2026-01-01',
    });

    expect(clock.baseDate?.toISOString()).toBe('2030-04-01T00:00:00.000Z');
    expect(clock.confidence).toBe('bureau_removal_date');
  });

  it('falls back from dofd to last activity to date reported', () => {
    expect(
      getObsolescenceClock({
        dateOfFirstDelinquency: '2017-05-10',
        dateOfLastActivity: '2019-02-01',
        dateReported: '2026-01-01',
      }).confidence,
    ).toBe('dofd');

    expect(
      getObsolescenceClock({
        dateOfLastActivity: '2019-02-01',
        dateReported: '2026-01-01',
      }).confidence,
    ).toBe('last_activity');

    expect(
      getObsolescenceClock({
        dateReported: '2026-01-01',
      }).confidence,
    ).toBe('date_reported');
  });

  it('preserves the legacy helper behavior through the shared module', () => {
    const result = getObsolescenceBaseDate({
      dateOfFirstDelinquency: '2018-01-01',
      dateOfLastActivity: '2019-01-01',
      dateReported: '2026-01-01',
    });

    expect(result?.toISOString()).toBe('2018-01-01T00:00:00.000Z');
  });

  it('prefers bureau stated removal dates over computed FCRA expiration dates', () => {
    const clock = getObsolescenceClock({
      bureauStatedRemovalDate: '2025-03-01',
      dateOfFirstDelinquency: '2018-03-15',
      dateReported: '2026-06-01',
    });

    expect(clock.baseDate?.toISOString()).toBe('2025-03-01T00:00:00.000Z');
    expect(clock.confidence).toBe('bureau_removal_date');
  });

  it('suppresses FCRA violation wording when the clock only has report-date confidence', () => {
    const result = buildFcraComplianceStatus({
      confidence: 'date_reported',
      reportingLimitYears: 7,
      daysUntilExpiration: -10,
    });

    expect(result.isPastLimit).toBe(true);
    expect(result.disputeStatus).toBeNull();
    expect(result.notes).toContain('Low-confidence estimate');
    expect(result.notes).not.toContain('FCRA VIOLATION');
  });

  it('keeps violation wording when the clock has stronger evidence', () => {
    const result = buildFcraComplianceStatus({
      confidence: 'dofd',
      reportingLimitYears: 7,
      daysUntilExpiration: -10,
    });

    expect(result.disputeStatus).toBe('pending');
    expect(result.notes).toContain('FCRA VIOLATION');
  });
});

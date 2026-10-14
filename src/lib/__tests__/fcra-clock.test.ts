import { describe, expect, it } from 'vitest';
import {
  buildFcraComplianceStatus,
  daysUntilExpiration,
  getObsolescenceClock,
} from '@/lib/fcra-clock';

describe('fcra clock helpers', () => {
  it('treats a bureau stated removal date as the expiry, not a start date', () => {
    const clock = getObsolescenceClock({
      itemType: 'collection',
      bureauStatedRemovalDate: '2025-03-01',
      dateOfFirstDelinquency: '2018-03-15',
      dateReported: '2026-06-01',
    });

    expect(clock?.expiresOn.toISOString()).toBe('2025-03-01T00:00:00.000Z');
    expect(clock?.confidence).toBe('bureau_removal_date');
  });

  it('counts an item past its stated removal date as expired', () => {
    const clock = getObsolescenceClock({ itemType: 'collection', bureauStatedRemovalDate: '2025-02-01' });

    expect(daysUntilExpiration(clock!, new Date('2026-10-14T00:00:00.000Z'))).toBe(-620);
  });

  it('runs late payments seven years from the date of first delinquency', () => {
    const clock = getObsolescenceClock({ itemType: 'late_payment', dateOfFirstDelinquency: '2018-01-01' });

    expect(clock?.expiresOn.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(clock?.confidence).toBe('dofd');
  });

  it('adds the 180-day grace of 1681c(c) for collections and charge-offs', () => {
    expect(getObsolescenceClock({ itemType: 'collection', dateOfFirstDelinquency: '2018-01-01' })?.expiresOn.toISOString())
      .toBe('2025-06-30T00:00:00.000Z');
    expect(getObsolescenceClock({ itemType: 'charge_off', dateOfFirstDelinquency: '2018-01-01' })?.expiresOn.toISOString())
      .toBe('2025-06-30T00:00:00.000Z');
  });

  it('gives bankruptcies ten years unless they are chapter 13', () => {
    expect(getObsolescenceClock({ itemType: 'bankruptcy', dateReported: '2016-05-01' })?.reportingLimitYears).toBe(10);
    expect(getObsolescenceClock({ itemType: 'bankruptcy_chapter_13', dateReported: '2016-05-01' })?.reportingLimitYears).toBe(7);
  });

  it('falls back from dofd to last activity to date reported', () => {
    expect(
      getObsolescenceClock({ itemType: 'late_payment', dateOfFirstDelinquency: '2017-05-10', dateOfLastActivity: '2019-02-01', dateReported: '2026-01-01' })?.confidence,
    ).toBe('dofd');
    expect(
      getObsolescenceClock({ itemType: 'late_payment', dateOfLastActivity: '2019-02-01', dateReported: '2026-01-01' })?.confidence,
    ).toBe('last_activity');
    expect(getObsolescenceClock({ itemType: 'late_payment', dateReported: '2026-01-01' })?.confidence).toBe('date_reported');
    expect(getObsolescenceClock({ itemType: 'late_payment' })).toBeNull();
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

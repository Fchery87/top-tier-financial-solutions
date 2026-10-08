import { describe, expect, it } from 'vitest';
import {
  addCalendarMonths,
  decideInvoicePayable,
  describeBlocker,
  type PayableFacts,
} from '@/lib/billing-readiness';

const now = new Date('2027-06-01T12:00:00.000Z');

function facts(overrides: Partial<Omit<PayableFacts, 'engagement'>> & { engagement?: Partial<PayableFacts['engagement']> } = {}): PayableFacts {
  const { engagement, ...rest } = overrides;
  return {
    blockingGateChecks: [],
    hasServicesRenderedEvent: true,
    feeModel: 'flat_fee',
    now,
    ...rest,
    engagement: {
      status: 'active',
      salesChannel: 'online',
      servicePeriodEndsAt: null,
      resultsAchievedAt: null,
      resultsVerificationReportDate: null,
      resultsVerifiedAt: null,
      ...engagement,
    },
  };
}

function telemarketing(resultsAchievedAt: string, reportDate: string): PayableFacts {
  return facts({
    engagement: {
      salesChannel: 'telemarketing',
      servicePeriodEndsAt: new Date('2027-01-01T00:00:00.000Z'),
      resultsAchievedAt: new Date(resultsAchievedAt),
      resultsVerificationReportDate: new Date(reportDate),
      resultsVerifiedAt: new Date('2027-05-01T00:00:00.000Z'),
    },
  });
}

describe('addCalendarMonths', () => {
  it('keeps the day of month when the target month is long enough', () => {
    expect(addCalendarMonths(new Date('2026-01-15T18:30:00.000Z'), 6).toISOString()).toBe('2026-07-15T00:00:00.000Z');
  });

  it('clamps Aug 31 to Feb 28 in a common year and Feb 29 in a leap year', () => {
    expect(addCalendarMonths(new Date('2026-08-31T00:00:00.000Z'), 6).toISOString()).toBe('2027-02-28T00:00:00.000Z');
    expect(addCalendarMonths(new Date('2027-08-31T00:00:00.000Z'), 6).toISOString()).toBe('2028-02-29T00:00:00.000Z');
  });

  it('clamps Dec 31 to Jun 30 across a year boundary', () => {
    expect(addCalendarMonths(new Date('2026-12-31T00:00:00.000Z'), 6).toISOString()).toBe('2027-06-30T00:00:00.000Z');
  });
});

describe('decideInvoicePayable', () => {
  it('is payable for an online sale with a passed gate and a services-rendered event', () => {
    expect(decideInvoicePayable(facts())).toEqual({ payable: true });
  });

  it('blocks on open gate checks and a missing services-rendered event together', () => {
    expect(decideInvoicePayable(facts({
      blockingGateChecks: ['fee_terms_disclosed'],
      hasServicesRenderedEvent: false,
    }))).toEqual({
      payable: false,
      blockers: [
        { kind: 'compliance_gate', blockingChecks: ['fee_terms_disclosed'] },
        { kind: 'no_services_rendered' },
      ],
    });
  });

  it('reports a closed engagement with no service as closed without service', () => {
    expect(decideInvoicePayable(facts({
      hasServicesRenderedEvent: false,
      engagement: { status: 'closed' },
    }))).toEqual({ payable: false, blockers: [{ kind: 'engagement_closed_without_service' }] });
  });

  it('blocks while the sales channel is unknown', () => {
    expect(decideInvoicePayable(facts({ engagement: { salesChannel: null } })))
      .toEqual({ payable: false, blockers: [{ kind: 'sales_channel_unknown' }] });
  });

  it('blocks a telemarketing sale with nothing recorded and lists every reason', () => {
    expect(decideInvoicePayable(facts({ engagement: { salesChannel: 'telemarketing' } }))).toEqual({
      payable: false,
      blockers: [{
        kind: 'telemarketing_results_unverified',
        reasons: ['service_period_not_recorded', 'results_not_recorded'],
        earliestReportDate: null,
      }],
    });
  });

  it('blocks a telemarketing sale until the service period has ended', () => {
    const decision = decideInvoicePayable(facts({
      engagement: {
        salesChannel: 'telemarketing',
        servicePeriodEndsAt: now,
        resultsAchievedAt: new Date('2026-06-01T00:00:00.000Z'),
        resultsVerificationReportDate: new Date('2026-12-01T00:00:00.000Z'),
      },
    }));
    expect(decision).toEqual({
      payable: false,
      blockers: [{
        kind: 'telemarketing_results_unverified',
        reasons: ['service_period_not_ended'],
        earliestReportDate: new Date('2026-12-01T00:00:00.000Z'),
      }],
    });
  });

  it('blocks a verifying report dated the day before six calendar months and allows the day of', () => {
    expect(decideInvoicePayable(telemarketing('2026-03-15T14:00:00.000Z', '2026-09-14T00:00:00.000Z'))).toEqual({
      payable: false,
      blockers: [{
        kind: 'telemarketing_results_unverified',
        reasons: ['verification_report_too_early'],
        earliestReportDate: new Date('2026-09-15T00:00:00.000Z'),
      }],
    });
    expect(decideInvoicePayable(telemarketing('2026-03-15T14:00:00.000Z', '2026-09-15T00:00:00.000Z')))
      .toEqual({ payable: true });
  });

  it('applies the month-end clamp at the telemarketing boundary', () => {
    expect(decideInvoicePayable(telemarketing('2026-08-31T00:00:00.000Z', '2027-02-27T00:00:00.000Z')))
      .toMatchObject({ payable: false, blockers: [{ reasons: ['verification_report_too_early'] }] });
    expect(decideInvoicePayable(telemarketing('2026-08-31T00:00:00.000Z', '2027-02-28T00:00:00.000Z')))
      .toEqual({ payable: true });
  });

  it('blocks pay-per-delete fees until a verifying report is recorded', () => {
    expect(decideInvoicePayable(facts({ feeModel: 'pay_per_delete' })))
      .toEqual({ payable: false, blockers: [{ kind: 'pay_per_delete_results_unverified' }] });
    expect(decideInvoicePayable(facts({
      feeModel: 'pay_per_delete',
      engagement: {
        resultsVerificationReportDate: new Date('2027-05-01T00:00:00.000Z'),
        resultsVerifiedAt: new Date('2027-05-02T00:00:00.000Z'),
      },
    }))).toEqual({ payable: true });
  });
});

describe('describeBlocker', () => {
  it('names the earliest acceptable report date for the telemarketing lock', () => {
    expect(describeBlocker({
      kind: 'telemarketing_results_unverified',
      reasons: ['verification_report_too_early'],
      earliestReportDate: new Date('2026-09-15T00:00:00.000Z'),
    })).toBe(
      'Telemarketed credit repair cannot be billed yet: the verifying credit report is dated less than 6 months after the results. The verifying report must be dated 2026-09-15 or later.',
    );
  });
});

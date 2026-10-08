import type { ComplianceGateCheckKey } from '@/lib/compliance-gate';

export type SalesChannel = 'telemarketing' | 'online' | 'in_person';

export const SALES_CHANNELS: readonly SalesChannel[] = ['telemarketing', 'online', 'in_person'];

export type FeeModel = 'subscription' | 'pay_per_delete' | 'milestone' | 'flat_fee';

export type TelemarketingLockReason =
  | 'service_period_not_recorded'
  | 'service_period_not_ended'
  | 'results_not_recorded'
  | 'verification_report_missing'
  | 'verification_report_too_early';

export type Blocker =
  | { kind: 'compliance_gate'; blockingChecks: ComplianceGateCheckKey[] }
  | { kind: 'no_services_rendered' }
  | { kind: 'sales_channel_unknown' }
  | { kind: 'telemarketing_results_unverified'; reasons: TelemarketingLockReason[]; earliestReportDate: Date | null }
  | { kind: 'pay_per_delete_results_unverified' }
  | { kind: 'engagement_closed_without_service' };

export type PayableDecision = { payable: true } | { payable: false; blockers: Blocker[] };

/** Loaded from the database for one engagement. Never built from a request body. */
export type PayableFacts = {
  blockingGateChecks: ComplianceGateCheckKey[];
  hasServicesRenderedEvent: boolean;
  feeModel: FeeModel | null;
  engagement: {
    status: 'active' | 'closed' | 'superseded';
    salesChannel: SalesChannel | null;
    servicePeriodEndsAt: Date | null;
    resultsAchievedAt: Date | null;
    resultsVerificationReportDate: Date | null;
    resultsVerifiedAt: Date | null;
  };
  now: Date;
};

export const TELEMARKETING_VERIFICATION_MONTHS = 6;

function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Returns the UTC calendar day `months` after `date`, at midnight, clamping to the last day of a
 * shorter target month (Aug 31 + 6 months = Feb 28, or Feb 29 in a leap year).
 */
export function addCalendarMonths(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDayOfTarget = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDayOfTarget);
  return new Date(Date.UTC(year, month, day));
}

function telemarketingLock(engagement: PayableFacts['engagement'], now: Date): Blocker | null {
  const reasons: TelemarketingLockReason[] = [];
  let earliestReportDate: Date | null = null;

  if (!engagement.servicePeriodEndsAt) {
    reasons.push('service_period_not_recorded');
  } else if (engagement.servicePeriodEndsAt.getTime() >= now.getTime()) {
    reasons.push('service_period_not_ended');
  }

  if (!engagement.resultsAchievedAt) {
    reasons.push('results_not_recorded');
  } else {
    earliestReportDate = addCalendarMonths(engagement.resultsAchievedAt, TELEMARKETING_VERIFICATION_MONTHS);
    if (!engagement.resultsVerificationReportDate) {
      reasons.push('verification_report_missing');
    } else if (utcDay(engagement.resultsVerificationReportDate) < earliestReportDate.getTime()) {
      // Report dates are calendar days; comparing whole UTC days keeps a time-of-day from shifting the boundary.
      reasons.push('verification_report_too_early');
    }
  }

  return reasons.length > 0
    ? { kind: 'telemarketing_results_unverified', reasons, earliestReportDate }
    : null;
}

export function decideInvoicePayable(facts: PayableFacts): PayableDecision {
  const blockers: Blocker[] = [];

  if (facts.blockingGateChecks.length > 0) {
    blockers.push({ kind: 'compliance_gate', blockingChecks: facts.blockingGateChecks });
  }

  if (!facts.hasServicesRenderedEvent) {
    blockers.push(facts.engagement.status === 'active'
      ? { kind: 'no_services_rendered' }
      : { kind: 'engagement_closed_without_service' });
  }

  if (facts.engagement.salesChannel === null) {
    blockers.push({ kind: 'sales_channel_unknown' });
  } else if (facts.engagement.salesChannel === 'telemarketing') {
    const lock = telemarketingLock(facts.engagement, facts.now);
    if (lock) blockers.push(lock);
  }

  if (facts.feeModel === 'pay_per_delete' && (!facts.engagement.resultsVerifiedAt || !facts.engagement.resultsVerificationReportDate)) {
    blockers.push({ kind: 'pay_per_delete_results_unverified' });
  }

  return blockers.length > 0 ? { payable: false, blockers } : { payable: true };
}

const TELEMARKETING_REASON_COPY: Record<TelemarketingLockReason, string> = {
  service_period_not_recorded: 'the represented service period end date is not recorded',
  service_period_not_ended: 'the represented service period has not ended',
  results_not_recorded: 'the date the results were achieved is not recorded',
  verification_report_missing: 'no verifying credit report is attached',
  verification_report_too_early: 'the verifying credit report is dated less than 6 months after the results',
};

function formatDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function describeBlocker(blocker: Blocker): string {
  switch (blocker.kind) {
    case 'compliance_gate':
      return `The compliance gate has open checks: ${blocker.blockingChecks.join(', ')}.`;
    case 'no_services_rendered':
      return 'No services-rendered event is recorded for this engagement.';
    case 'engagement_closed_without_service':
      return 'The engagement closed before any service was rendered, so no fee can be charged.';
    case 'sales_channel_unknown':
      return 'Record how this sale was made (telemarketing, online or in person) before invoicing.';
    case 'telemarketing_results_unverified': {
      const reasons = blocker.reasons.map((reason) => TELEMARKETING_REASON_COPY[reason]).join('; ');
      const earliest = blocker.earliestReportDate
        ? ` The verifying report must be dated ${formatDay(blocker.earliestReportDate)} or later.`
        : '';
      return `Telemarketed credit repair cannot be billed yet: ${reasons}.${earliest}`;
    }
    case 'pay_per_delete_results_unverified':
      return 'Pay-per-delete fees stay locked until a credit report verifying the result is recorded.';
  }
}

type BillingReadinessParams = {
  hasQualifyingServicesRenderedEvent: boolean;
  feeModel?: string | null;
  hasVerifiedResult?: boolean;
};

export type BillingReadinessCode =
  | 'SERVICES_RENDERED_EVENT_REQUIRED'
  | 'RESULTS_VERIFIED_BILLING_LOCK'
  | null;

type BillingReadiness =
  | {
      payable: false;
      code: Exclude<BillingReadinessCode, null>;
      reason: string;
    }
  | {
      payable: true;
      code: null;
      reason: null;
    };

export function evaluateBillingReadiness(params: BillingReadinessParams): BillingReadiness {
  if (!params.hasQualifyingServicesRenderedEvent) {
    return {
      payable: false,
      code: 'SERVICES_RENDERED_EVENT_REQUIRED',
      reason: 'A qualifying Services Rendered event is required before an invoice can become payable',
    };
  }

  if (params.feeModel === 'pay_per_delete' && params.hasVerifiedResult !== true) {
    return {
      payable: false,
      code: 'RESULTS_VERIFIED_BILLING_LOCK',
      reason: 'Result-based fees require verified result documentation before an invoice can become payable',
    };
  }

  return {
    payable: true,
    code: null,
    reason: null,
  };
}

const UTC_DAY_MS = 24 * 60 * 60 * 1000;

export interface CfpbEligibility {
  eligible: boolean;
  reason: 'eligible' | 'missing_cra_dispute' | 'not_sent' | 'still_pending';
  eligibleAt: Date | null;
}

function utcDateStart(value: Date): number {
  return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
}

export function assessCfpbEligibility(input: {
  submittedToCra: boolean;
  sentAt: Date | null;
  responseReceivedAt: Date | null;
}, now = new Date()): CfpbEligibility {
  if (!input.submittedToCra) return { eligible: false, reason: 'missing_cra_dispute', eligibleAt: null };
  if (!input.sentAt) return { eligible: false, reason: 'not_sent', eligibleAt: null };

  const eligibleAt = new Date(utcDateStart(input.sentAt) + 45 * UTC_DAY_MS);
  const responseReceived = input.responseReceivedAt !== null && input.responseReceivedAt.getTime() <= now.getTime();
  if (responseReceived || utcDateStart(now) >= eligibleAt.getTime()) {
    return { eligible: true, reason: 'eligible', eligibleAt };
  }

  return { eligible: false, reason: 'still_pending', eligibleAt };
}

export type ObsolescenceClockConfidence =
  | 'bureau_removal_date'
  | 'dofd'
  | 'last_activity'
  | 'date_reported';

export interface ObsolescenceClockInput {
  bureauStatedRemovalDate?: string | Date | null;
  dateOfFirstDelinquency?: string | Date | null;
  dateOfLastActivity?: string | Date | null;
  dateReported?: string | Date | null;
}

export interface ObsolescenceClockResult {
  baseDate: Date | null;
  confidence: ObsolescenceClockConfidence | null;
}

export interface FcraComplianceStatusInput {
  confidence: ObsolescenceClockConfidence | null;
  reportingLimitYears: number;
  daysUntilExpiration: number | null;
}

export interface FcraComplianceStatusResult {
  isPastLimit: boolean;
  disputeStatus: 'pending' | null;
  notes: string | null;
}

function toValidDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getObsolescenceClock(input: ObsolescenceClockInput): ObsolescenceClockResult {
  const orderedSources: Array<{
    confidence: ObsolescenceClockConfidence;
    value: string | Date | null | undefined;
  }> = [
    { confidence: 'bureau_removal_date', value: input.bureauStatedRemovalDate },
    { confidence: 'dofd', value: input.dateOfFirstDelinquency },
    { confidence: 'last_activity', value: input.dateOfLastActivity },
    { confidence: 'date_reported', value: input.dateReported },
  ];

  for (const source of orderedSources) {
    const baseDate = toValidDate(source.value);
    if (baseDate) {
      return { baseDate, confidence: source.confidence };
    }
  }

  return { baseDate: null, confidence: null };
}

export function getObsolescenceBaseDate(input: ObsolescenceClockInput): Date | null {
  return getObsolescenceClock(input).baseDate;
}

export function buildFcraComplianceStatus(input: FcraComplianceStatusInput): FcraComplianceStatusResult {
  const isPastLimit = input.daysUntilExpiration !== null && input.daysUntilExpiration <= 0;

  if (isPastLimit) {
    if (input.confidence === 'date_reported') {
      return {
        isPastLimit: true,
        disputeStatus: null,
        notes: `Low-confidence estimate: item appears past the ${input.reportingLimitYears}-year reporting limit, but the clock is based only on the report date. Verify DOFD or bureau removal date before treating this as an FCRA violation.`,
      };
    }

    return {
      isPastLimit: true,
      disputeStatus: 'pending',
      notes: `FCRA VIOLATION: Item past ${input.reportingLimitYears}-year reporting limit. Immediate dispute recommended.`,
    };
  }

  if (input.daysUntilExpiration !== null && input.daysUntilExpiration < 180) {
    return {
      isPastLimit: false,
      disputeStatus: null,
      notes: `Item expires in ${input.daysUntilExpiration} days. Consider waiting or disputing.`,
    };
  }

  return {
    isPastLimit: false,
    disputeStatus: null,
    notes: null,
  };
}

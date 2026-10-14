export type ObsolescenceClockConfidence =
  | 'bureau_removal_date'
  | 'dofd'
  | 'last_activity'
  | 'date_reported';

export interface ObsolescenceClockInput {
  itemType: string;
  bureauStatedRemovalDate?: string | Date | null;
  dateOfFirstDelinquency?: string | Date | null;
  dateOfLastActivity?: string | Date | null;
  dateReported?: string | Date | null;
}

/** When an item stops being reportable, and which on-report date that answer rests on. */
export interface ObsolescenceClock {
  expiresOn: Date;
  confidence: ObsolescenceClockConfidence;
  reportingLimitYears: number;
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

// 15 U.S.C. § 1681c(c): for collections and charge-offs the seven years begin
// 180 days after the delinquency that preceded them.
const COLLECTION_GRACE_DAYS = 180;
const DAY_MS = 1000 * 60 * 60 * 24;

function toValidDate(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** 15 U.S.C. § 1681c(a). Chapter 13 uses the bureaus' seven-year practice; other bankruptcies get the statutory ten. */
export function getReportingLimitYears(itemType: string): number {
  const type = itemType.toLowerCase();
  if (!type.includes('bankruptcy')) return 7;
  return /chapter_?13|chapter 13|ch_?13/.test(type) ? 7 : 10;
}

function runsFromCollectionGrace(itemType: string): boolean {
  const type = itemType.toLowerCase();
  return type === 'collection' || type === 'charge_off';
}

/**
 * A bureau's "on record until" date is the expiry itself. Every other date is the
 * start of the clock, so the reporting period is added to it.
 */
export function getObsolescenceClock(input: ObsolescenceClockInput): ObsolescenceClock | null {
  const reportingLimitYears = getReportingLimitYears(input.itemType);

  const removalDate = toValidDate(input.bureauStatedRemovalDate);
  if (removalDate) {
    return { expiresOn: removalDate, confidence: 'bureau_removal_date', reportingLimitYears };
  }

  const startSources: Array<{ confidence: ObsolescenceClockConfidence; value: string | Date | null | undefined }> = [
    { confidence: 'dofd', value: input.dateOfFirstDelinquency },
    { confidence: 'last_activity', value: input.dateOfLastActivity },
    { confidence: 'date_reported', value: input.dateReported },
  ];

  for (const source of startSources) {
    const start = toValidDate(source.value);
    if (!start) continue;

    const expiresOn = new Date(start);
    expiresOn.setUTCFullYear(expiresOn.getUTCFullYear() + reportingLimitYears);
    if (runsFromCollectionGrace(input.itemType)) {
      expiresOn.setUTCDate(expiresOn.getUTCDate() + COLLECTION_GRACE_DAYS);
    }
    return { expiresOn, confidence: source.confidence, reportingLimitYears };
  }

  return null;
}

export function daysUntilExpiration(clock: ObsolescenceClock, now: Date = new Date()): number {
  return Math.ceil((clock.expiresOn.getTime() - now.getTime()) / DAY_MS);
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

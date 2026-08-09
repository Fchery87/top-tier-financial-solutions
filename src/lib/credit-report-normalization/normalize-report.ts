import type { SourceDetectionResult } from '@/lib/parsers/detect-source';
import type { ParsedAccount, ParsedCreditData, ParsedNegativeItem } from '@/lib/parsers/pdf-parser';
import {
  SPECIFIC_BUREAUS,
  type NormalizationWarning,
  type NormalizedCreditReport,
  type SpecificBureau,
} from './types';

export interface NormalizeCreditReportInput {
  parsed: ParsedCreditData;
  source: SourceDetectionResult;
}

function normalizeBureau(value: string | undefined): SpecificBureau | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return SPECIFIC_BUREAUS.find((bureau) => bureau === normalized) ?? null;
}

function stableRecordId(kind: 'account' | 'negative-item', index: number, creditorName: string, accountNumber: string | undefined): string {
  const normalizePart = (value: string) => value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
  return `${kind}:${index}:${normalizePart(creditorName)}:${normalizePart(accountNumber || 'unknown')}`;
}

function hasObservedEvidence(evidence: object | undefined): boolean {
  return evidence !== undefined && Object.values(evidence).some((value) => value !== undefined);
}

function collectAccountBureaus(account: ParsedAccount, recordId: string, warnings: NormalizationWarning[]): SpecificBureau[] {
  const observed = new Set<SpecificBureau>();
  const directBureau = normalizeBureau(account.bureau);
  if (directBureau) observed.add(directBureau);
  else if (account.bureau && account.bureau.trim().toLowerCase() !== 'combined') {
    warnings.push({ code: 'unsupported_bureau', recordId, value: account.bureau });
  }

  for (const bureau of SPECIFIC_BUREAUS) {
    if (hasObservedEvidence(account.bureauEvidence?.[bureau])) {
      observed.add(bureau);
    }
  }

  return [...observed];
}

function collectNegativeItemBureaus(item: ParsedNegativeItem, recordId: string, warnings: NormalizationWarning[]): SpecificBureau[] {
  const bureau = normalizeBureau(item.bureau);
  if (bureau) return [bureau];
  if (item.bureau && item.bureau.trim().toLowerCase() !== 'combined') {
    warnings.push({ code: 'unsupported_bureau', recordId, value: item.bureau });
  }
  return [];
}

function reportSourceConflicts(
  source: SourceDetectionResult,
  recordId: string,
  observedBureaus: SpecificBureau[],
  warnings: NormalizationWarning[],
): void {
  const detectedBureau = source.detectedBureau;
  if (!detectedBureau || detectedBureau === 'combined') return;

  for (const observedBureau of observedBureaus) {
    if (observedBureau !== detectedBureau) {
      warnings.push({
        code: 'source_bureau_conflict',
        recordId,
        value: observedBureau,
      });
    }
  }
}

/**
 * Converts parser output into a deterministic review model. It does not infer
 * cross-bureau presence from a combined report or modify the raw parsed facts.
 */
export function normalizeCreditReport({ parsed, source }: NormalizeCreditReportInput): NormalizedCreditReport {
  const warnings: NormalizationWarning[] = [];
  const accounts = parsed.accounts.map((account, index) => {
    const id = stableRecordId('account', index, account.creditorName, account.accountNumber);
    const observedBureaus = collectAccountBureaus(account, id, warnings);
    reportSourceConflicts(source, id, observedBureaus, warnings);
    return { id, account, observedBureaus };
  });
  const negativeItems = parsed.negativeItems.map((item, index) => {
    const id = stableRecordId('negative-item', index, item.creditorName, item.accountNumber);
    const observedBureaus = collectNegativeItemBureaus(item, id, warnings);
    reportSourceConflicts(source, id, observedBureaus, warnings);
    return { id, item, observedBureaus };
  });

  return { source, accounts, negativeItems, warnings };
}

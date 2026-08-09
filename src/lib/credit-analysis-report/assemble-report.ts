import type { NormalizedCreditReport } from '@/lib/credit-report-normalization/types';
import type { ParsedCreditData } from '@/lib/parsers/pdf-parser';

export interface AssembleCreditAnalysisReportInput {
  client: {
    firstName: string;
    lastName: string;
  };
  normalized: NormalizedCreditReport;
  scores: ParsedCreditData['scores'];
}

export interface ClientSafeCreditAnalysisReport {
  clientName: string;
  scores: ParsedCreditData['scores'];
  accounts: Array<{
    id: string;
    creditorName: string;
    accountType?: string;
    accountStatus?: string;
    observedBureaus: string[];
  }>;
  negativeItems: Array<{
    id: string;
    creditorName: string;
    itemType: string;
    riskSeverity: string;
    observedBureaus: string[];
  }>;
  requiresReview: boolean;
  warningCodes: string[];
}

function displayName(firstName: string, lastName: string): string {
  return [firstName, lastName].filter((name) => name.trim().length > 0).join(' ') || 'Client';
}

/**
 * Builds the data-only report model for client presentation. Raw account
 * numbers, parser source text, and warning values remain outside this seam.
 */
export function assembleCreditAnalysisReport({
  client,
  normalized,
  scores,
}: AssembleCreditAnalysisReportInput): ClientSafeCreditAnalysisReport {
  return {
    clientName: displayName(client.firstName, client.lastName),
    scores,
    accounts: normalized.accounts.map(({ id, account, observedBureaus }) => ({
      id,
      creditorName: account.creditorName,
      accountType: account.accountType,
      accountStatus: account.accountStatus,
      observedBureaus,
    })),
    negativeItems: normalized.negativeItems.map(({ id, item, observedBureaus }) => ({
      id,
      creditorName: item.creditorName,
      itemType: item.itemType,
      riskSeverity: item.riskSeverity,
      observedBureaus,
    })),
    requiresReview: normalized.warnings.length > 0,
    warningCodes: [...new Set(normalized.warnings.map((warning) => warning.code))],
  };
}

import type {
  ParsedAccount,
  ParsedNegativeItem,
} from '@/lib/parsers/pdf-parser';
import type { SourceDetectionResult } from '@/lib/parsers/detect-source';

export const SPECIFIC_BUREAUS = ['transunion', 'experian', 'equifax'] as const;

export type SpecificBureau = typeof SPECIFIC_BUREAUS[number];

export type NormalizationWarning =
  | {
      code: 'unsupported_bureau';
      recordId: string;
      value: string;
    }
  | {
      code: 'source_bureau_conflict';
      recordId: string;
      value: SpecificBureau;
    };

export interface NormalizedCreditAccount {
  id: string;
  account: ParsedAccount;
  observedBureaus: SpecificBureau[];
}

export interface NormalizedNegativeItem {
  id: string;
  item: ParsedNegativeItem;
  observedBureaus: SpecificBureau[];
}

export interface NormalizedCreditReport {
  source: SourceDetectionResult;
  accounts: NormalizedCreditAccount[];
  negativeItems: NormalizedNegativeItem[];
  warnings: NormalizationWarning[];
}

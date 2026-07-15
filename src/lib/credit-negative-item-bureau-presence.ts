import { getAccountPresence } from './credit-account-bureau-presence';
import type { ParsedAccount, ParsedAccountBureau, ParsedNegativeItem, DerogatoryAccount } from './parsers/pdf-parser';

const SPECIFIC_BUREAUS: ParsedAccountBureau[] = ['transunion', 'experian', 'equifax'];

type NegativeItemPresence = {
  onTransunion: boolean;
  onExperian: boolean;
  onEquifax: boolean;
  transunionDate?: Date;
  experianDate?: Date;
  equifaxDate?: Date;
  transunionStatus?: string;
  experianStatus?: string;
  equifaxStatus?: string;
};

function hasDerogatoryEvidence(value?: string): boolean {
  return !!value && value !== '-';
}

function parseBureauDate(dateStr: string | undefined): Date | undefined {
  if (!hasDerogatoryEvidence(dateStr)) return undefined;
  const parsed = new Date(dateStr as string);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function getNegativeItemPresence(params: {
  item: ParsedNegativeItem;
  reportBureau: string | null;
  derogatoryMatch?: DerogatoryAccount;
  matchedAccount?: ParsedAccount;
}): NegativeItemPresence {
  const { item, reportBureau, derogatoryMatch, matchedAccount } = params;
  const reportBureauLower = reportBureau?.toLowerCase();

  if (derogatoryMatch) {
    return {
      onTransunion: hasDerogatoryEvidence(derogatoryMatch.transunion.accountDate),
      onExperian: hasDerogatoryEvidence(derogatoryMatch.experian.accountDate),
      onEquifax: hasDerogatoryEvidence(derogatoryMatch.equifax.accountDate),
      transunionDate: parseBureauDate(derogatoryMatch.transunion.accountDate),
      experianDate: parseBureauDate(derogatoryMatch.experian.accountDate),
      equifaxDate: parseBureauDate(derogatoryMatch.equifax.accountDate),
      transunionStatus: derogatoryMatch.transunion.accountStatus || derogatoryMatch.transunion.paymentStatus,
      experianStatus: derogatoryMatch.experian.accountStatus || derogatoryMatch.experian.paymentStatus,
      equifaxStatus: derogatoryMatch.equifax.accountStatus || derogatoryMatch.equifax.paymentStatus,
    };
  }

  if (matchedAccount) {
    const accountPresence = getAccountPresence(matchedAccount, reportBureau);

    return {
      onTransunion: accountPresence.onTransunion,
      onExperian: accountPresence.onExperian,
      onEquifax: accountPresence.onEquifax,
      transunionDate: accountPresence.transunionDate,
      experianDate: accountPresence.experianDate,
      equifaxDate: accountPresence.equifaxDate,
    };
  }

  if (reportBureauLower && SPECIFIC_BUREAUS.includes(reportBureauLower as ParsedAccountBureau)) {
    return {
      onTransunion: reportBureauLower === 'transunion',
      onExperian: reportBureauLower === 'experian',
      onEquifax: reportBureauLower === 'equifax',
      transunionDate: reportBureauLower === 'transunion' ? item.dateReported : undefined,
      experianDate: reportBureauLower === 'experian' ? item.dateReported : undefined,
      equifaxDate: reportBureauLower === 'equifax' ? item.dateReported : undefined,
    };
  }

  return {
    onTransunion: false,
    onExperian: false,
    onEquifax: false,
  };
}

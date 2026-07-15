import type { ParsedAccount, ParsedAccountBureau } from './parsers/pdf-parser';

const SPECIFIC_BUREAUS: ParsedAccountBureau[] = ['transunion', 'experian', 'equifax'];

export function getAccountPresence(account: ParsedAccount, reportBureau: string | null): {
  onTransunion: boolean;
  onExperian: boolean;
  onEquifax: boolean;
  transunionDate?: Date;
  experianDate?: Date;
  equifaxDate?: Date;
  transunionBalance?: number;
  experianBalance?: number;
  equifaxBalance?: number;
} {
  const bureauEvidence = account.bureauEvidence;
  const reportBureauLower = reportBureau?.toLowerCase();

  const hasEvidenceFor = (bureau: ParsedAccountBureau) => {
    const evidence = bureauEvidence?.[bureau];
    return !!evidence && Object.values(evidence).some(value => value !== undefined);
  };

  if (bureauEvidence && SPECIFIC_BUREAUS.some(hasEvidenceFor)) {
    const transunionEvidence = bureauEvidence.transunion;
    const experianEvidence = bureauEvidence.experian;
    const equifaxEvidence = bureauEvidence.equifax;

    return {
      onTransunion: hasEvidenceFor('transunion'),
      onExperian: hasEvidenceFor('experian'),
      onEquifax: hasEvidenceFor('equifax'),
      transunionDate: transunionEvidence?.dateReported ?? transunionEvidence?.dateOpened,
      experianDate: experianEvidence?.dateReported ?? experianEvidence?.dateOpened,
      equifaxDate: equifaxEvidence?.dateReported ?? equifaxEvidence?.dateOpened,
      transunionBalance: transunionEvidence?.balance,
      experianBalance: experianEvidence?.balance,
      equifaxBalance: equifaxEvidence?.balance,
    };
  }

  if (reportBureauLower && SPECIFIC_BUREAUS.includes(reportBureauLower as ParsedAccountBureau)) {
    return {
      onTransunion: reportBureauLower === 'transunion',
      onExperian: reportBureauLower === 'experian',
      onEquifax: reportBureauLower === 'equifax',
      transunionDate: reportBureauLower === 'transunion' ? account.dateReported : undefined,
      experianDate: reportBureauLower === 'experian' ? account.dateReported : undefined,
      equifaxDate: reportBureauLower === 'equifax' ? account.dateReported : undefined,
      transunionBalance: reportBureauLower === 'transunion' ? account.balance : undefined,
      experianBalance: reportBureauLower === 'experian' ? account.balance : undefined,
      equifaxBalance: reportBureauLower === 'equifax' ? account.balance : undefined,
    };
  }

  if (account.bureau) {
    const accountBureauLower = account.bureau.toLowerCase();
    if (SPECIFIC_BUREAUS.includes(accountBureauLower as ParsedAccountBureau)) {
      return {
        onTransunion: accountBureauLower === 'transunion',
        onExperian: accountBureauLower === 'experian',
        onEquifax: accountBureauLower === 'equifax',
        transunionDate: accountBureauLower === 'transunion' ? account.dateReported : undefined,
        experianDate: accountBureauLower === 'experian' ? account.dateReported : undefined,
        equifaxDate: accountBureauLower === 'equifax' ? account.dateReported : undefined,
        transunionBalance: accountBureauLower === 'transunion' ? account.balance : undefined,
        experianBalance: accountBureauLower === 'experian' ? account.balance : undefined,
        equifaxBalance: accountBureauLower === 'equifax' ? account.balance : undefined,
      };
    }
  }

  const hasStrongSingleBureauBasis = !!account.dateReported || !!account.balance || !!account.accountNumber;

  if (reportBureauLower === 'combined') {
    return {
      onTransunion: false,
      onExperian: false,
      onEquifax: false,
      transunionDate: undefined,
      experianDate: undefined,
      equifaxDate: undefined,
      transunionBalance: undefined,
      experianBalance: undefined,
      equifaxBalance: undefined,
    };
  }

  if (hasStrongSingleBureauBasis) {
    return {
      onTransunion: true,
      onExperian: true,
      onEquifax: true,
      transunionDate: account.dateReported,
      experianDate: account.dateReported,
      equifaxDate: account.dateReported,
      transunionBalance: account.balance,
      experianBalance: account.balance,
      equifaxBalance: account.balance,
    };
  }

  return {
    onTransunion: false,
    onExperian: false,
    onEquifax: false,
    transunionDate: undefined,
    experianDate: undefined,
    equifaxDate: undefined,
    transunionBalance: undefined,
    experianBalance: undefined,
    equifaxBalance: undefined,
  };
}

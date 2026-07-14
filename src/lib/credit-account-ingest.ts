import { type StandardizedAccount, calculateCompletenessScore } from './parsers/metro2-mapping';

interface CreditAccountCompletenessInput {
  creditorName: string;
  accountNumber?: string;
  accountType?: string;
  accountStatus?: string;
  balance?: number;
  creditLimit?: number;
  highCredit?: number;
  dateOpened?: Date;
  dateReported?: Date;
  paymentStatus?: string;
  remarks?: string;
}

export function buildCreditAccountDerivedFields(account: CreditAccountCompletenessInput) {
  const accountStatus = account.accountStatus as StandardizedAccount['accountStatus'] | undefined;
  const paymentStatus = account.paymentStatus as StandardizedAccount['paymentStatus'] | undefined;

  const { score, missingFields } = calculateCompletenessScore({
    creditorName: account.creditorName,
    accountNumber: account.accountNumber,
    accountType: account.accountType,
    accountStatus,
    balance: account.balance,
    creditLimit: account.creditLimit,
    highCredit: account.highCredit,
    dateOpened: account.dateOpened,
    dateReported: account.dateReported,
    paymentStatus,
  });

  return {
    completenessScore: score,
    missingFields,
    remarks: account.remarks,
  };
}

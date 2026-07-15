import { bureauDiscrepancies, creditAccounts } from '@/db/schema';
import { randomUUID } from 'crypto';

type BureauAccountSnapshot = Pick<
  typeof creditAccounts.$inferSelect,
  | 'creditReportId'
  | 'creditorName'
  | 'accountNumber'
  | 'onTransunion'
  | 'onExperian'
  | 'onEquifax'
  | 'transunionBalance'
  | 'experianBalance'
  | 'equifaxBalance'
>;

export function buildAccountBalanceDiscrepancies(
  clientId: string,
  creditReportId: string,
  accounts: BureauAccountSnapshot[]
): Array<typeof bureauDiscrepancies.$inferInsert> {
  const discrepancies: Array<typeof bureauDiscrepancies.$inferInsert> = [];

  for (const account of accounts) {
    const bureauBalances = [
      account.onTransunion ? account.transunionBalance : null,
      account.onExperian ? account.experianBalance : null,
      account.onEquifax ? account.equifaxBalance : null,
    ].filter((balance): balance is number => balance !== null);

    if (bureauBalances.length < 2) {
      continue;
    }

    if (new Set(bureauBalances).size > 1) {
      discrepancies.push({
        id: randomUUID(),
        clientId,
        creditReportId,
        discrepancyType: 'account_balance',
        field: 'balance',
        creditorName: account.creditorName,
        accountNumber: account.accountNumber,
        valueTransunion: account.onTransunion ? account.transunionBalance?.toString() || null : null,
        valueExperian: account.onExperian ? account.experianBalance?.toString() || null : null,
        valueEquifax: account.onEquifax ? account.equifaxBalance?.toString() || null : null,
        severity: 'medium',
        isDisputable: true,
        disputeRecommendation: 'Balance differs across bureaus within this report pull. Request verification from the reporting bureaus.',
        createdAt: new Date(),
      });
    }
  }

  return discrepancies;
}

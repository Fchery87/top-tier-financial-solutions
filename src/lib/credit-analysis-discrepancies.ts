import { bureauDiscrepancies, creditAccounts } from '@/db/schema';
import { randomUUID } from 'crypto';
import { groupAcrossBureaus } from '@/lib/tradeline-matching';

type BureauAccountRow = Pick<
  typeof creditAccounts.$inferSelect,
  'creditorName' | 'accountNumber' | 'bureau' | 'tradelineKey' | 'dateOpened' | 'balance'
>;

/** Each stored row is one bureau's view of an account, so balances are compared across rows. */
export function buildAccountBalanceDiscrepancies(
  clientId: string,
  creditReportId: string,
  accounts: BureauAccountRow[]
): Array<typeof bureauDiscrepancies.$inferInsert> {
  const discrepancies: Array<typeof bureauDiscrepancies.$inferInsert> = [];

  for (const group of groupAcrossBureaus(accounts)) {
    const balances = [...group.values()].map(row => row.balance).filter((balance): balance is number => balance !== null);
    if (balances.length < 2 || new Set(balances).size === 1) continue;

    const anyRow = [...group.values()][0];
    const valueFor = (bureau: 'transunion' | 'experian' | 'equifax') => group.get(bureau)?.balance?.toString() ?? null;
    discrepancies.push({
      id: randomUUID(),
      clientId,
      creditReportId,
      discrepancyType: 'account_balance',
      field: 'balance',
      creditorName: anyRow.creditorName,
      accountNumber: anyRow.accountNumber,
      valueTransunion: valueFor('transunion'),
      valueExperian: valueFor('experian'),
      valueEquifax: valueFor('equifax'),
      severity: 'medium',
      isDisputable: true,
      disputeRecommendation: 'Balance differs across bureaus within this report pull. Request verification from the reporting bureaus.',
      createdAt: new Date(),
    });
  }

  return discrepancies;
}

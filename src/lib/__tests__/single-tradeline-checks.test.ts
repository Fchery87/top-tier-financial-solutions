import { describe, expect, it } from 'vitest';
import { checkSingleTradeline } from '@/lib/single-tradeline-checks';

describe('checkSingleTradeline', () => {
  it('flags a delinquency before the account was opened', () => {
    expect(checkSingleTradeline({ dateOpened: '2019-06-15', dateOfFirstDelinquency: '2019-02-01' })).toEqual([{
      code: 'impossible_dates',
      tier: 'objective',
      text: 'The date of first delinquency (2/2019) is earlier than the date the account was opened (6/2019). An account cannot become delinquent before it exists.',
    }]);
  });

  it('does not flag dates in the same month', () => {
    expect(checkSingleTradeline({ dateOpened: '2019-06-15', dateOfFirstDelinquency: '2019-06-01', dateOfLastPayment: '2019-06-02' })).toEqual([]);
  });

  it('holds a scheduled payment on a charged-off account for review', () => {
    expect(checkSingleTradeline({ accountStatus: 'charge_off', monthlyPayment: 4500 })).toEqual([{
      code: 'scheduled_payment_after_chargeoff',
      tier: 'interpretive',
      text: 'The account is reported as charge_off but still shows a scheduled monthly payment of $45.00. A closed or charged-off account has no scheduled payment.',
    }]);
  });

  it('flags new lates reported after the charge-off month', () => {
    const [finding] = checkSingleTradeline({ paymentHistory: { '2024-01': '90', '2024-02': 'CO', '2024-03': '30', '2024-04': 'CO' } });
    expect(finding).toMatchObject({ code: 'lates_after_chargeoff', tier: 'interpretive' });
    expect(finding.text).toContain('2024-02, then reports new late payments afterward (2024-03)');
  });

  it('flags a balance on an account included in bankruptcy', () => {
    expect(checkSingleTradeline({ accountStatus: 'charge_off', remarks: 'Included in Chapter 7 bankruptcy', balance: 120000 })).toEqual([{
      code: 'balance_after_bankruptcy',
      tier: 'objective',
      text: 'The account is reported as included in bankruptcy but still shows a balance of $1,200.00. An account included in bankruptcy should report no balance owed.',
    }]);
  });

  it('flags a balance on a sold account but not on the collector that bought it', () => {
    expect(checkSingleTradeline({ accountStatus: 'closed', remarks: 'Account sold to another lender', balance: 5000 }).map(item => item.code)).toEqual(['balance_after_transfer']);
    expect(checkSingleTradeline({ accountStatus: 'collection', remarks: 'Purchased account, sold by original creditor', balance: 5000 })).toEqual([]);
  });
});

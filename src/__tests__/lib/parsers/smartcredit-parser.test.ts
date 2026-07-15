import { describe, expect, it } from 'vitest';
import { parseSmartCreditReport } from '@/lib/parsers/smartcredit-parser';

describe('SmartCredit parser', () => {
  it('emits bureauEvidence for bureau-scoped account sections', () => {
    const html = `
      <html>
        <body>
          <section data-bureau="transunion" class="bureau-section">
            <div class="account-item">
              <div class="creditor">Capital Bank</div>
              <div class="acct-number">***1111</div>
              <div class="acct-type">Revolving</div>
              <div class="acct-status">Open</div>
              <div class="balance-amount">$123.45</div>
              <div class="credit-limit">$500.00</div>
              <div class="date-opened">01/15/2020</div>
              <div class="date-reported">03/01/2024</div>
            </div>
          </section>
        </body>
      </html>
    `;

    const result = parseSmartCreditReport(html);
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0]).toMatchObject({
      bureau: 'transunion',
      bureauEvidence: {
        transunion: {
          accountNumber: '***1111',
          accountType: 'Revolving',
          accountStatus: 'open',
          balance: 12345,
          creditLimit: 50000,
          paymentStatus: 'current',
          sourceText: expect.stringContaining('Capital Bank'),
        },
      },
    });
    expect(result.accounts[0].bureauEvidence?.transunion?.dateOpened?.toISOString()).toBe('2020-01-15T00:00:00.000Z');
    expect(result.accounts[0].bureauEvidence?.transunion?.dateReported?.toISOString()).toBe('2024-03-01T00:00:00.000Z');
  });

  it('extracts bureau removal dates from negative sections', () => {
    const html = `
      <html>
        <body>
          <div class="negative-accounts">
            <div class="collection-item">
              MIDLAND CREDIT balance $540.00 on record until 08/2028
            </div>
          </div>
        </body>
      </html>
    `;

    const result = parseSmartCreditReport(html);
    const item = result.negativeItems.find(entry => entry.creditorName.includes('MIDLAND CREDIT'));

    expect(item).toBeDefined();
    expect(item?.bureauStatedRemovalDate?.toISOString()).toBe('2028-08-01T00:00:00.000Z');
  });
});

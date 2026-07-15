import { describe, expect, it } from 'vitest';
import { parseMyScoreIQReport } from '@/lib/parsers/myscoreiq-parser';

describe('MyScoreIQ parser', () => {
  it('emits bureauEvidence for bureau-scoped account sections', () => {
    const html = `
      <html>
        <body>
          <section data-bureau="equifax">
            <div class="account-entry">
              <div class="creditor">State Credit Union</div>
              <div class="account-number">***2222</div>
              <div class="account-type">Installment</div>
              <div class="status">Closed</div>
              <div class="balance">$0.00</div>
              <div class="limit">$2,000.00</div>
              <div class="opened">02/20/2021</div>
              <div class="reported">04/10/2024</div>
            </div>
          </section>
        </body>
      </html>
    `;

    const result = parseMyScoreIQReport(html);
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0]).toMatchObject({
      bureau: 'equifax',
      bureauEvidence: {
        equifax: {
          accountNumber: '***2222',
          accountType: 'Installment',
          accountStatus: 'closed',
          balance: 0,
          creditLimit: 200000,
          paymentStatus: 'current',
          sourceText: expect.stringContaining('State Credit Union'),
        },
      },
    });
    expect(result.accounts[0].bureauEvidence?.equifax?.dateOpened?.toISOString()).toBe('2021-02-20T00:00:00.000Z');
    expect(result.accounts[0].bureauEvidence?.equifax?.dateReported?.toISOString()).toBe('2024-04-10T00:00:00.000Z');
  });

  it('extracts bureau removal dates from alert sections', () => {
    const html = `
      <html>
        <body>
          <div class="negative-alerts">
            <div class="item">
              PORTFOLIO RECOVERY collection balance $812.00 will be removed by 11/2027
            </div>
          </div>
        </body>
      </html>
    `;

    const result = parseMyScoreIQReport(html);
    const item = result.negativeItems.find(entry => entry.creditorName.includes('PORTFOLIO RECOVERY'));

    expect(item).toBeDefined();
    expect(item?.bureauStatedRemovalDate?.toISOString()).toBe('2027-11-01T00:00:00.000Z');
  });
});

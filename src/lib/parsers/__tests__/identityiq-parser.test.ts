import { describe, expect, it } from 'vitest';
import { parseIdentityIQReport } from '@/lib/parsers/identityiq-parser';

describe('parseIdentityIQReport negative item clock extraction', () => {
  it('extracts bureau-specific DOFD and removal dates from IdentityIQ tradelines', () => {
    const html = `
      <div id="CreditScore"></div>
      <address-history>
        <div class="sub_header ng-binding ng-scope">Collection Agency (Original Creditor: 11 Sprint)</div>
        <table class="crPrint ng-scope">
          <tr>
            <td>
              <table class="rpt_content_table rpt_table4column">
                <tr>
                  <td>Account #</td>
                  <td>***1111</td>
                  <td>***2222</td>
                  <td>***3333</td>
                </tr>
                <tr>
                  <td>Account Type</td>
                  <td>Collection</td>
                  <td>Collection</td>
                  <td>Collection</td>
                </tr>
                <tr>
                  <td>Account Status</td>
                  <td>Derogatory</td>
                  <td>Derogatory</td>
                  <td>Derogatory</td>
                </tr>
                <tr>
                  <td>Payment Status</td>
                  <td>Collection</td>
                  <td>Collection</td>
                  <td>Collection</td>
                </tr>
              </table>
              <div>
                TransUnion Date of First Delinquency: 01/15/2018 On record until: 02/2025
                Experian Date of First Delinquency: 02/20/2018 Will be removed by: 03/2025
                Equifax Date of First Delinquency: 03/25/2018 Scheduled to continue until: 04/2025
              </div>
            </td>
          </tr>
        </table>
      </address-history>
    `;

    const result = parseIdentityIQReport(html);

    const transunionItem = result.negativeItems.find(
      item => item.bureau === 'transunion' && item.creditorName === 'Collection Agency' && item.originalCreditor === 'Sprint',
    );
    const experianItem = result.negativeItems.find(
      item => item.bureau === 'experian' && item.creditorName === 'Collection Agency' && item.originalCreditor === 'Sprint',
    );
    const equifaxItem = result.negativeItems.find(
      item => item.bureau === 'equifax' && item.creditorName === 'Collection Agency' && item.originalCreditor === 'Sprint',
    );

    expect(transunionItem?.dateOfFirstDelinquency?.toISOString()).toBe('2018-01-15T00:00:00.000Z');
    expect(transunionItem?.bureauStatedRemovalDate?.toISOString()).toBe('2025-02-01T00:00:00.000Z');
    expect(experianItem?.dateOfFirstDelinquency?.toISOString()).toBe('2018-02-20T00:00:00.000Z');
    expect(experianItem?.bureauStatedRemovalDate?.toISOString()).toBe('2025-03-01T00:00:00.000Z');
    expect(equifaxItem?.dateOfFirstDelinquency?.toISOString()).toBe('2018-03-25T00:00:00.000Z');
    expect(equifaxItem?.bureauStatedRemovalDate?.toISOString()).toBe('2025-04-01T00:00:00.000Z');
  });

  it('emits bureau evidence for each extracted tradeline account', () => {
    const html = `
      <div id="CreditScore"></div>
      <address-history>
        <div class="sub_header ng-binding ng-scope">Capital Bank</div>
        <table class="crPrint ng-scope">
          <tr>
            <td>
              <table class="rpt_content_table rpt_table4column">
                <tr>
                  <td>Account #</td>
                  <td>***1111</td>
                  <td>-</td>
                  <td>***3333</td>
                </tr>
                <tr>
                  <td>Account Type</td>
                  <td>Revolving</td>
                  <td>-</td>
                  <td>Mortgage</td>
                </tr>
                <tr>
                  <td>Account Status</td>
                  <td>Open</td>
                  <td>-</td>
                  <td>Closed</td>
                </tr>
                <tr>
                  <td>Balance:</td>
                  <td>$123.45</td>
                  <td>-</td>
                  <td>$456.78</td>
                </tr>
                <tr>
                  <td>Credit Limit</td>
                  <td>$1,000.00</td>
                  <td>-</td>
                  <td>$2,500.00</td>
                </tr>
                <tr>
                  <td>Date Opened</td>
                  <td>01/15/2020</td>
                  <td>-</td>
                  <td>02/20/2021</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </address-history>
    `;

    const result = parseIdentityIQReport(html);
    const transunionAccount = result.accounts.find(account => account.bureau === 'transunion');
    const equifaxAccount = result.accounts.find(account => account.bureau === 'equifax');

    expect(result.accounts).toHaveLength(3);
    expect(transunionAccount?.bureauEvidence?.transunion).toMatchObject({
      accountNumber: '***1111',
      accountType: 'Revolving',
      accountStatus: 'Open',
      balance: 12345,
      creditLimit: 100000,
    });
    expect(transunionAccount?.bureauEvidence?.transunion?.dateOpened?.toISOString()).toBe('2020-01-15T00:00:00.000Z');

    expect(equifaxAccount?.bureauEvidence?.equifax).toMatchObject({
      accountNumber: '***3333',
      accountType: 'Mortgage',
      accountStatus: 'Closed',
      balance: 45678,
      creditLimit: 250000,
    });
    expect(equifaxAccount?.bureauEvidence?.equifax?.dateOpened?.toISOString()).toBe('2021-02-20T00:00:00.000Z');
  });
});

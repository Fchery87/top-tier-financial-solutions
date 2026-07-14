import { describe, expect, it } from 'vitest';
import { parseSmartCreditReport } from '@/lib/parsers/smartcredit-parser';

describe('SmartCredit parser', () => {
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

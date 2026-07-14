import { describe, expect, it } from 'vitest';
import { parseExperianReport } from '@/lib/parsers/experian-parser';

describe('Experian parser', () => {
  it('extracts DOFD and bureau removal date from negative account content', () => {
    const html = `
      <html>
        <body>
          <div class="account-card negative-info">
            <div class="creditor-name">MIDLAND CREDIT</div>
            <div class="account-status">Collection</div>
            <div class="balance">$1,245.00</div>
            <div>Date Reported: 06/01/2026</div>
            <div>Date of First Delinquency: 03/15/2018</div>
            <div>On record until: 03/2025</div>
          </div>
        </body>
      </html>
    `;

    const result = parseExperianReport(html);
    const item = result.negativeItems.find(entry => entry.creditorName === 'MIDLAND CREDIT');

    expect(item).toBeDefined();
    expect(item?.dateOfFirstDelinquency?.toISOString()).toBe('2018-03-15T00:00:00.000Z');
    expect(item?.bureauStatedRemovalDate?.toISOString()).toBe('2025-03-01T00:00:00.000Z');
  });
});

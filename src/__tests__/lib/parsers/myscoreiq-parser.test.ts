import { describe, expect, it } from 'vitest';
import { parseMyScoreIQReport } from '@/lib/parsers/myscoreiq-parser';

describe('MyScoreIQ parser', () => {
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

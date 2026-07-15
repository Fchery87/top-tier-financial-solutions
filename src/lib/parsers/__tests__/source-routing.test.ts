import { describe, expect, it } from 'vitest';
import { detectHtmlSource, detectPdfSource } from '@/lib/parsers/detect-source';
import { parseHtmlCreditReport } from '@/lib/parsers/html-parser';
import { parserFixtures } from '@/lib/parsers/__tests__/fixtures';

describe('parser fixture routing corpus', () => {
  for (const [name, fixture] of Object.entries(parserFixtures)) {
    it(`routes fixture ${name} to the expected source`, () => {
      const detection = fixture.kind === 'pdf' ? detectPdfSource(fixture.content) : detectHtmlSource(fixture.content);
      expect(detection.source).toBe(fixture.expectedSource);
      expect(detection.detectedBureau).toBe(fixture.expectedBureau);
    });
  }

  it('parses generic html fixture through fallback parser with source metadata', () => {
    const result = parseHtmlCreditReport(parserFixtures.genericHtml.content);
    expect(result.detectedSource?.source).toBe('unknown');
    expect(Array.isArray(result.accounts)).toBe(true);
  });
});

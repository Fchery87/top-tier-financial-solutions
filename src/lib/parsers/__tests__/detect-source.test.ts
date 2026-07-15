import { describe, expect, it } from 'vitest';
import { detectBureau, detectCreditReportSource, detectHtmlSource, detectPdfSource } from '@/lib/parsers/detect-source';

describe('detect-source', () => {
  it('does not classify single-bureau text as combined from EX/EQ/TU abbreviations alone', () => {
    const content = 'Experian Credit Report\nAccount reviewed by EX team\ninternal code TU-123';
    expect(detectBureau(content)).toBe('experian');
  });

  it('requires full bureau evidence before returning combined', () => {
    const content = 'TransUnion Credit Report\nExperian Credit Report\nSummary for both bureaus';
    expect(detectBureau(content)).toBe('combined');
  });

  it('detects supported sources consistently across entry points', () => {
    const identityIq = 'Your IdentityIQ Report <div class="iq-report">IdentityIQ.com</div>';
    expect(detectCreditReportSource(identityIq).source).toBe('identityiq');
    expect(detectHtmlSource(identityIq).source).toBe('identityiq');

    const smartCredit = 'Powered by SmartCredit\nSmartCredit Report';
    expect(detectPdfSource(smartCredit).source).toBe('smartcredit');
  });
});

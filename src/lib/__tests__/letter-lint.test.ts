import { describe, expect, it } from 'vitest';
import { lintGeneratedLetter } from '@/lib/letter-lint';

describe('lintGeneratedLetter', () => {
  const baseContext = {
    reasonCodes: ['verification_required'],
    items: [{
      creditorName: 'Example Creditor',
      originalCreditor: 'Original Creditor',
      accountNumber: '****4321',
      bureau: 'experian',
    }],
    allowThreatLanguage: false,
    identityTheftFlag: false,
  };

  it('fails ownership-denial language without an approved reason code', () => {
    const result = lintGeneratedLetter('This account does not belong to me.', baseContext);
    expect(result.passed).toBe(false);
    expect(result.reasons[0]).toContain('ownership-denial');
  });

  it('fails threat language when not authorized', () => {
    const result = lintGeneratedLetter('I will seek statutory damages for willful non-compliance.', baseContext);
    expect(result.passed).toBe(false);
    expect(result.reasons[0]).toContain('threat or damages');
  });

  it('fails statute citations outside the allowlist', () => {
    const result = lintGeneratedLetter('This violates FCRA Section 999.', baseContext);
    expect(result.passed).toBe(false);
    expect(result.reasons[0]).toContain('allowlist');
  });

  it('fails mismatched account details', () => {
    const result = lintGeneratedLetter('Creditor Name: Wrong Creditor\nAccount Number: ****9999', baseContext);
    expect(result.passed).toBe(false);
    expect(result.reasons.join(' ')).toContain('source data');
  });
});

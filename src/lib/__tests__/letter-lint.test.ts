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
    identityTheftFlag: false,
  };

  it('warns on ownership-denial language without an approved reason code', () => {
    const result = lintGeneratedLetter('This account does not belong to me.', baseContext);
    expect(result.blocked).toBe(false);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'ownership_denial',
      severity: 'warn',
    }));
  });

  it('warns on threat language without blocking', () => {
    const result = lintGeneratedLetter('I will seek statutory damages for willful non-compliance.', baseContext);
    expect(result.blocked).toBe(false);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'threat_language',
      severity: 'warn',
    }));
  });

  it('warns on statute citations outside the allowlist', () => {
    const result = lintGeneratedLetter('This violates FCRA Section 999.', baseContext);
    expect(result.blocked).toBe(false);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'statute_not_allowlisted',
      severity: 'warn',
    }));
  });

  it('blocks mismatched account details', () => {
    const result = lintGeneratedLetter('Creditor Name: Wrong Creditor\nAccount Number: ****9999', baseContext);
    expect(result.blocked).toBe(true);
    expect(result.findings.every(finding => finding.severity === 'block')).toBe(true);
  });

  it('blocks undocumented identity-theft claims', () => {
    const result = lintGeneratedLetter('This is identity theft.', baseContext);
    expect(result.blocked).toBe(true);
    expect(result.findings).toContainEqual(expect.objectContaining({
      code: 'undocumented_identity_theft',
      severity: 'block',
    }));
  });

  it('allows cross-referencing another bureau', () => {
    const result = lintGeneratedLetter('I have also filed this dispute with Equifax and TransUnion.', baseContext);
    expect(result.findings).toHaveLength(0);
  });

  it('allows the alternate FCRA statute names', () => {
    const result = lintGeneratedLetter('Under 15 U.S.C. § 1681e(b) and § 1681b, please investigate.', baseContext);
    expect(result.findings).toHaveLength(0);
  });
});

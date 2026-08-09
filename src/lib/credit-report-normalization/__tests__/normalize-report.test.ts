import { describe, expect, it } from 'vitest';
import { normalizeCreditReport } from '@/lib/credit-report-normalization/normalize-report';
import type { ParsedCreditData } from '@/lib/parsers/pdf-parser';

function parsedReport(overrides: Partial<ParsedCreditData> = {}): ParsedCreditData {
  return {
    scores: {},
    accounts: [{
      creditorName: 'Capital Bank',
      accountNumber: '1234',
      accountType: 'revolving',
      isNegative: false,
      bureauEvidence: {
        experian: { accountNumber: '1234', balance: 10_000 },
      },
    }],
    negativeItems: [{
      itemType: 'collection',
      creditorName: 'Example Collection',
      accountNumber: '5678',
      riskSeverity: 'high',
    }],
    inquiries: [],
    summary: {
      totalAccounts: 1,
      openAccounts: 1,
      closedAccounts: 0,
      totalDebt: 10_000,
      totalCreditLimit: 20_000,
      utilizationPercent: 50,
    },
    rawText: 'fixture',
    ...overrides,
  };
}

describe('normalizeCreditReport', () => {
  it('assigns stable identifiers and keeps only explicit bureau observations', () => {
    const result = normalizeCreditReport({
      parsed: parsedReport(),
      source: { source: 'unknown', confidence: 'low', signatures: [] },
    });

    expect(result.accounts[0]).toMatchObject({
      id: 'account:0:capital-bank:1234',
      observedBureaus: ['experian'],
    });
    expect(result.negativeItems[0]).toMatchObject({
      id: 'negative-item:0:example-collection:5678',
      observedBureaus: [],
    });
    expect(result.accounts[0]?.observedBureaus).not.toContain('transunion');
    expect(result.accounts[0]?.observedBureaus).not.toContain('equifax');
  });

  it('reports unsupported bureau values instead of coercing them', () => {
    const result = normalizeCreditReport({
      parsed: parsedReport({
        accounts: [{
          creditorName: 'Capital Bank',
          accountNumber: '1234',
          bureau: 'other-credit-bureau',
          isNegative: false,
        }],
      }),
      source: { source: 'unknown', confidence: 'low', signatures: [] },
    });

    expect(result.accounts[0]?.observedBureaus).toEqual([]);
    expect(result.warnings).toContainEqual({
      code: 'unsupported_bureau',
      recordId: 'account:0:capital-bank:1234',
      value: 'other-credit-bureau',
    });
  });

  it('reports evidence that conflicts with a single-bureau source', () => {
    const result = normalizeCreditReport({
      parsed: parsedReport(),
      source: {
        source: 'experian',
        confidence: 'high',
        detectedBureau: 'experian',
        signatures: ['experian'],
      },
    });

    expect(result.warnings).toEqual([]);

    const conflicting = normalizeCreditReport({
      parsed: parsedReport({
        accounts: [{
          creditorName: 'Capital Bank',
          accountNumber: '1234',
          isNegative: false,
          bureauEvidence: { transunion: { accountNumber: '1234' } },
        }],
      }),
      source: {
        source: 'experian',
        confidence: 'high',
        detectedBureau: 'experian',
        signatures: ['experian'],
      },
    });

    expect(conflicting.warnings).toContainEqual({
      code: 'source_bureau_conflict',
      recordId: 'account:0:capital-bank:1234',
      value: 'transunion',
    });
  });
});

import { describe, expect, it } from 'vitest';
import { assembleCreditAnalysisReport } from '@/lib/credit-analysis-report/assemble-report';

describe('assembleCreditAnalysisReport', () => {
  it('builds a client-safe view without raw account numbers or warning values', () => {
    const result = assembleCreditAnalysisReport({
      client: { firstName: 'Alex', lastName: 'Example' },
      normalized: {
        source: { source: 'unknown', confidence: 'low', signatures: [] },
        accounts: [{
          id: 'account:0:capital-bank:1234',
          account: {
            creditorName: 'Capital Bank',
            accountNumber: '1234',
            accountType: 'revolving',
            accountStatus: 'open',
            isNegative: false,
          },
          observedBureaus: ['experian'],
        }],
        negativeItems: [{
          id: 'negative-item:0:example-collection:5678',
          item: {
            creditorName: 'Example Collection',
            accountNumber: '5678',
            itemType: 'collection',
            riskSeverity: 'high',
          },
          observedBureaus: [],
        }],
        warnings: [{
          code: 'unsupported_bureau',
          recordId: 'account:0:capital-bank:1234',
          value: 'other-credit-bureau',
        }],
      },
      scores: { experian: 680 },
    });

    expect(result).toEqual({
      clientName: 'Alex Example',
      scores: { experian: 680 },
      accounts: [{
        id: 'account:0:capital-bank:1234',
        creditorName: 'Capital Bank',
        accountType: 'revolving',
        accountStatus: 'open',
        observedBureaus: ['experian'],
      }],
      negativeItems: [{
        id: 'negative-item:0:example-collection:5678',
        creditorName: 'Example Collection',
        itemType: 'collection',
        riskSeverity: 'high',
        observedBureaus: [],
      }],
      requiresReview: true,
      warningCodes: ['unsupported_bureau'],
    });
  });
});

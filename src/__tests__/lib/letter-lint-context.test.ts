import { describe, expect, it } from 'vitest';
import { buildLetterLintContextForDispute } from '@/lib/letter-lint-context';

describe('buildLetterLintContextForDispute', () => {
  it('uses a valid persisted snapshot before legacy dispute fields', () => {
    const context = buildLetterLintContextForDispute({
      reasonCodes: ['legacy_reason'],
      creditorName: 'Legacy Creditor',
      accountNumber: '****9999',
      bureau: 'experian',
      letterContextSnapshot: JSON.stringify({
        reasonCodes: ['snapshot_reason'],
        items: [{ creditorName: 'Snapshot Creditor', accountNumber: '****1111', bureau: 'transunion' }],
        identityTheftFlag: true,
      }),
    });

    expect(context).toEqual({
      reasonCodes: ['snapshot_reason'],
      items: [{ creditorName: 'Snapshot Creditor', accountNumber: '****1111', bureau: 'transunion' }],
      identityTheftFlag: true,
    });
  });

  it('falls back to legacy fields when no valid snapshot is available', () => {
    const context = buildLetterLintContextForDispute({
      reasonCodes: ['not_mine'],
      creditorName: 'Legacy Creditor',
      accountNumber: '****9999',
      bureau: 'experian',
      letterContextSnapshot: '{bad json',
    });

    expect(context.items[0]).toMatchObject({
      creditorName: 'Legacy Creditor',
      accountNumber: '****9999',
      bureau: 'experian',
    });
    expect(context.reasonCodes).toEqual(['not_mine']);
  });

  it('rejects snapshots containing unvalidated values', () => {
    const context = buildLetterLintContextForDispute({
      reasonCodes: ['fallback'],
      creditorName: 'Fallback Creditor',
      letterContextSnapshot: JSON.stringify({ reasonCodes: [42], items: [] }),
    });

    expect(context.reasonCodes).toEqual(['fallback']);
    expect(context.items[0]?.creditorName).toBe('Fallback Creditor');
  });
});

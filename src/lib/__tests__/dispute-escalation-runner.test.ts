import { beforeAll, describe, expect, it } from 'vitest';

let buildEscalationLetterParams: typeof import('@/lib/dispute-escalation-runner').buildEscalationLetterParams;

beforeAll(async () => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
  ({ buildEscalationLetterParams } = await import('@/lib/dispute-escalation-runner'));
});

describe('buildEscalationLetterParams', () => {
  it('uses the linked masked account number instead of an internal id fragment', () => {
    const params = buildEscalationLetterParams({
      client: { firstName: 'Jane', lastName: 'Doe' },
      dispute: { bureau: 'experian' },
      negativeItem: {
        id: '7f3aa2d6-1fb6-4fd4-9171-ff1122334455',
        creditorName: 'Example Creditor',
        originalCreditor: 'Original Creditor',
        itemType: 'collection',
        amount: 15500,
        dateReported: new Date('2026-01-10T00:00:00.000Z'),
      },
      creditAccount: {
        accountNumber: '****4321',
      },
      plan: {
        disputeType: 'method_of_verification',
        nextRound: 2,
        targetRecipient: 'bureau',
        methodology: 'method_of_verification',
        reasonCodes: ['no_response'],
        customReason: 'No response received.',
      },
    });

    expect(params.itemData.accountNumber).toBe('****4321');
  });

  it('omits the account number when no linked account number exists', () => {
    const params = buildEscalationLetterParams({
      client: { firstName: 'Jane', lastName: 'Doe' },
      dispute: { bureau: 'experian' },
      negativeItem: {
        id: '7f3aa2d6-1fb6-4fd4-9171-ff1122334455',
        creditorName: 'Example Creditor',
        originalCreditor: null,
        itemType: 'collection',
        amount: 15500,
        dateReported: new Date('2026-01-10T00:00:00.000Z'),
      },
      creditAccount: null,
      plan: {
        disputeType: 'method_of_verification',
        nextRound: 2,
        targetRecipient: 'bureau',
        methodology: 'method_of_verification',
        reasonCodes: ['no_response'],
        customReason: 'No response received.',
      },
    });

    expect(params.itemData.accountNumber).toBeUndefined();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryChain } from '@/__tests__/fixtures/compliance-gate';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/db/client', () => ({ db: dbMock }));

const now = new Date('2026-03-10T12:00:00.000Z');

function queueLoad(overrides: {
  engagement?: unknown[];
  agreement?: unknown[];
  disclosures?: unknown[];
  portalDocuments?: unknown[];
  identityDocuments?: unknown[];
  firstEvent?: unknown[];
  payments?: unknown[];
} = {}) {
  const engagement = overrides.engagement ?? [{ clientId: 'client-1', clientUserId: 'user-1' }];
  dbMock.select.mockReturnValueOnce(queryChain(engagement));
  if (engagement.length === 0) return;
  const agreement = overrides.agreement ?? [{
    id: 'agreement-1',
    cancellationDeadline: new Date('2026-03-05T00:00:00.000Z'),
    cancelledAt: null,
    feeTermsSnapshot: 'Standard plan',
  }];
  dbMock.select.mockReturnValueOnce(queryChain(agreement));
  if (agreement.length > 0) {
    dbMock.select.mockReturnValueOnce(queryChain(overrides.disclosures ?? [{ acknowledged: true }]));
  }
  dbMock.select
    .mockReturnValueOnce(queryChain(overrides.portalDocuments ?? [{ fileType: 'id_document' }]))
    .mockReturnValueOnce(queryChain(overrides.identityDocuments ?? [{ fileType: 'proof_of_address' }]))
    .mockReturnValueOnce(queryChain(overrides.firstEvent ?? []))
    .mockReturnValueOnce(queryChain(overrides.payments ?? []));
}

describe('loadComplianceGateFacts', () => {
  beforeEach(() => vi.resetAllMocks());

  it('combines portal and staff-uploaded documents through the document checklist', async () => {
    const { loadComplianceGateFacts } = await import('@/lib/compliance-gate-sync');
    queueLoad();

    expect(await loadComplianceGateFacts('engagement-1')).toEqual({
      clientUserId: 'user-1',
      signedAgreement: {
        cancellationDeadline: new Date('2026-03-05T00:00:00.000Z'),
        cancelledAt: null,
        feeTermsSnapshot: 'Standard plan',
        disclosures: [{ acknowledged: true }],
      },
      documentChecklist: [
        { key: 'identity_document', label: 'Identity document', completed: true },
        { key: 'proof_of_address', label: 'Proof of address', completed: true },
      ],
      firstServicesRenderedAt: null,
      paymentReceivedAts: [],
    });
  });

  it('returns null for an unknown engagement', async () => {
    const { loadComplianceGateFacts } = await import('@/lib/compliance-gate-sync');
    queueLoad({ engagement: [] });

    expect(await loadComplianceGateFacts('missing')).toBeNull();
  });
});

describe('syncComplianceGate', () => {
  beforeEach(() => vi.resetAllMocks());

  it('upserts every derived check on (engagement_id, check_key) and returns the stored rows', async () => {
    const { syncComplianceGate } = await import('@/lib/compliance-gate-sync');
    queueLoad({
      agreement: [],
      payments: [{ receivedAt: new Date('2026-03-01T00:00:00.000Z') }],
    });
    const stored = [{ checkKey: 'onboarding_review_complete', passed: true, checkedAt: now, notes: 'ok' }];
    dbMock.select.mockReturnValueOnce(queryChain(stored));
    const insertChain = queryChain(undefined);
    dbMock.insert.mockReturnValue(insertChain);

    const result = await syncComplianceGate('engagement-1', now);

    expect(result).toBe(stored);
    const rows = insertChain.values.mock.calls[0][0] as Array<{ engagementId: string; checkKey: string; passed: boolean; notes: string | null }>;
    expect(rows.map((row) => [row.checkKey, row.passed])).toEqual([
      ['client_identity_linked', true],
      ['service_agreement_signed', false],
      ['croa_disclosure_acknowledged', false],
      ['cancellation_deadline_calculated', false],
      ['cancellation_window_complete', false],
      ['identity_document_uploaded', true],
      ['proof_of_address_uploaded', true],
      ['fee_terms_disclosed', false],
      ['no_upfront_payment_collected', false],
    ]);
    expect(rows.every((row) => row.engagementId === 'engagement-1')).toBe(true);
    expect(rows.find((row) => row.checkKey === 'no_upfront_payment_collected')?.notes)
      .toBe('A payment was received before services were rendered');

    const conflict = insertChain.onConflictDoUpdate.mock.calls[0][0] as { target: Array<{ name: string }> };
    expect(conflict.target.map((column) => column.name)).toEqual(['engagement_id', 'check_key']);
  });

  it('writes nothing for an unknown engagement', async () => {
    const { syncComplianceGate } = await import('@/lib/compliance-gate-sync');
    queueLoad({ engagement: [] });

    expect(await syncComplianceGate('missing', now)).toBeNull();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });
});

describe('attestComplianceGateCheck', () => {
  beforeEach(() => vi.resetAllMocks());

  it('upserts the attested row and logs admin activity in one transaction', async () => {
    const { attestComplianceGateCheck } = await import('@/lib/compliance-gate-sync');
    const gateInsert = queryChain(undefined);
    const activityInsert = queryChain(undefined);
    const tx = { insert: vi.fn().mockReturnValueOnce(gateInsert).mockReturnValueOnce(activityInsert) };
    dbMock.transaction.mockImplementation(async (callback: (executor: typeof tx) => Promise<void>) => callback(tx));

    await attestComplianceGateCheck({
      engagementId: 'engagement-1',
      checkKey: 'onboarding_review_complete',
      passed: true,
      notes: 'Reviewed file',
      actorUserId: 'staff-1',
      now,
    });

    expect(gateInsert.values).toHaveBeenCalledWith(expect.objectContaining({
      engagementId: 'engagement-1',
      checkKey: 'onboarding_review_complete',
      passed: true,
      notes: 'Reviewed file',
      checkedAt: now,
    }));
    expect(activityInsert.values).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'staff-1',
      action: 'compliance_gate.attest',
      subjectType: 'service_engagement',
      subjectId: 'engagement-1',
      metadata: JSON.stringify({ check_key: 'onboarding_review_complete', passed: true }),
    }));
  });
});

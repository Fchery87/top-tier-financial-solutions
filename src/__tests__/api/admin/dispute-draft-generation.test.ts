import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  transaction: vi.fn(),
}));

const txMock = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
}));

const requireCapabilityMock = vi.hoisted(() => vi.fn());
const generateUniqueDisputeLetterMock = vi.hoisted(() => vi.fn());
const selectLibraryForGenerationMock = vi.hoisted(() => vi.fn());
const requireLatestApprovedReportForClientMock = vi.hoisted(() => vi.fn());
const evaluateDisputeComplianceMock = vi.hoisted(() => vi.fn());
const approvedPolicyMatchesDisputeInputsMock = vi.hoisted(() => vi.fn());
const decideEscalationMock = vi.hoisted(() => vi.fn());
const loadDisputeChainMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/ai-letter-generator', () => ({
  generateUniqueDisputeLetter: generateUniqueDisputeLetterMock,
  generateMultiItemDisputeLetter: vi.fn(),
  DISPUTE_REASON_CODES: [],
}));
vi.mock('@/lib/letter-generation-library', () => ({ selectLibraryForGeneration: selectLibraryForGenerationMock }));
vi.mock('@/lib/parser-review-gate', () => ({ requireLatestApprovedReportForClient: requireLatestApprovedReportForClientMock }));
vi.mock('@/lib/dispute-compliance-policy', () => ({ evaluateDisputeCompliance: evaluateDisputeComplianceMock }));
vi.mock('@/lib/dispute-policy-decision', () => ({ approvedPolicyMatchesDisputeInputs: approvedPolicyMatchesDisputeInputsMock }));
vi.mock('@/lib/dispute-escalation-decision', () => ({ decideEscalation: decideEscalationMock, loadDisputeChain: loadDisputeChainMock }));

describe('POST /api/admin/disputes/drafts/generate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
    requireLatestApprovedReportForClientMock.mockResolvedValue({ allowed: true });
    evaluateDisputeComplianceMock.mockReturnValue({ isCompliant: true, violations: [] });
    approvedPolicyMatchesDisputeInputsMock.mockReturnValue(true);
    loadDisputeChainMock.mockResolvedValue([]);
    selectLibraryForGenerationMock.mockResolvedValue({
      chosen: { id: 'library-1', name: 'Verification strategy' },
      score: 8,
      rationale: ['matches bureau and reason'],
      runnersUp: [{ id: 'library-2', score: 6 }],
    });
    generateUniqueDisputeLetterMock.mockResolvedValue('Generated draft letter');
    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'client-1', firstName: 'Jane', lastName: 'Client' }]),
        }),
      }),
    });
    txMock.insert.mockImplementation(() => ({ values: vi.fn().mockResolvedValue(undefined) }));
    dbMock.transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock));
  });

  it('returns a persisted dispute ID, revision one, and durable library attribution', async () => {
    const { POST } = await import('@/app/api/admin/disputes/drafts/generate/route');
    const response = await POST(new NextRequest('http://localhost/api/admin/disputes/drafts/generate', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        bureau: 'experian',
        disputeItems: [{
          id: 'item-1',
          kind: 'tradeline',
          creditorName: 'Example Bank',
          accountNumber: '123456789',
          itemType: 'collection',
        }],
        reasonCodes: ['verification_required'],
        policyDecision: { approved: true, reasonCodes: ['verification_required'] },
      }),
    }));

    const body = await response.json();
    const disputeValues = txMock.insert.mock.results[0]?.value.values.mock.calls[0]?.[0];
    const revisionValues = txMock.insert.mock.results[1]?.value.values.mock.calls[0]?.[0];

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      dispute_id: expect.any(String),
      revision: 1,
      letter_content: 'Generated draft letter',
      library_selection: { chosen: { id: 'library-1' } },
    });
    expect(disputeValues).toMatchObject({
      letterTemplateId: 'library-1',
      status: 'draft',
    });
    expect(revisionValues).toMatchObject({
      disputeId: body.dispute_id,
      revision: 1,
      source: 'generated',
      generationMetadata: expect.stringContaining('library-1'),
    });
  });

  it('blocks CFPB generation when the predecessor ID is missing', async () => {
    const { POST } = await import('@/app/api/admin/disputes/drafts/generate/route');
    const response = await POST(new NextRequest('http://localhost/api/admin/disputes/drafts/generate', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        bureau: 'experian',
        targetRecipient: 'cfpb',
        disputeItems: [{ id: 'item-1', kind: 'tradeline' }],
        reasonCodes: ['verification_required'],
        policyDecision: { approved: true, reasonCodes: ['verification_required'] },
      }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ reason: 'missing_cra_dispute' });
    expect(loadDisputeChainMock).not.toHaveBeenCalled();
    expect(generateUniqueDisputeLetterMock).not.toHaveBeenCalled();
  });

  it('defers CFPB generation when the predecessor is still ineligible', async () => {
    loadDisputeChainMock.mockResolvedValue([{ id: 'cra-1', clientId: 'client-1', negativeItemId: 'item-1', targetRecipient: 'bureau', sentAt: new Date('2026-07-20T00:00:00.000Z') }]);
    decideEscalationMock.mockReturnValue({
      kind: 'blocked',
      message: 'CFPB escalation is deferred until 2026-09-03T00:00:00.000Z.',
      eligibility: { eligible: false, reason: 'still_pending', eligibleAt: new Date('2026-09-03T00:00:00.000Z') },
    });
    const { POST } = await import('@/app/api/admin/disputes/drafts/generate/route');

    const response = await POST(new NextRequest('http://localhost/api/admin/disputes/drafts/generate', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        bureau: 'experian',
        targetRecipient: 'cfpb',
        priorDisputeId: 'cra-1',
        disputeItems: [{ id: 'item-1', kind: 'tradeline' }],
        reasonCodes: ['verification_required'],
        policyDecision: { approved: true, reasonCodes: ['verification_required'] },
      }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ reason: 'still_pending', eligible_at: '2026-09-03T00:00:00.000Z' });
    expect(generateUniqueDisputeLetterMock).not.toHaveBeenCalled();
  });

  it('rejects a legacy multi-item CFPB request before generation', async () => {
    const { POST } = await import('@/app/api/admin/disputes/drafts/generate/route');
    const response = await POST(new NextRequest('http://localhost/api/admin/disputes/drafts/generate', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        bureau: 'experian',
        targetRecipient: 'cfpb',
        negativeItemIds: ['item-1', 'item-2'],
        priorDisputeId: 'cra-1',
        reasonCodes: ['verification_required'],
        policyDecision: { approved: true, reasonCodes: ['verification_required'] },
      }),
    }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'CFPB generation requires exactly one item per eligible CRA predecessor' });
    expect(loadDisputeChainMock).not.toHaveBeenCalled();
    expect(generateUniqueDisputeLetterMock).not.toHaveBeenCalled();
  });

  it('rejects a CFPB request when the CRA predecessor has no item attribution', async () => {
    loadDisputeChainMock.mockResolvedValue([{ id: 'cra-1', clientId: 'client-1', negativeItemId: null, targetRecipient: 'bureau', sentAt: new Date('2026-06-01T00:00:00.000Z') }]);
    decideEscalationMock.mockReturnValue({
      kind: 'ready',
      plan: { targetRecipient: 'cfpb' },
      eligibility: { eligible: true, reason: 'eligible', eligibleAt: null },
    });
    const { POST } = await import('@/app/api/admin/disputes/drafts/generate/route');

    const response = await POST(new NextRequest('http://localhost/api/admin/disputes/drafts/generate', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        bureau: 'experian',
        targetRecipient: 'cfpb',
        priorDisputeId: 'cra-1',
        disputeItems: [{ id: 'item-1', kind: 'tradeline' }],
        reasonCodes: ['verification_required'],
        policyDecision: { approved: true, reasonCodes: ['verification_required'] },
      }),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: 'The prior CRA dispute does not match the selected item' });
    expect(generateUniqueDisputeLetterMock).not.toHaveBeenCalled();
  });
});

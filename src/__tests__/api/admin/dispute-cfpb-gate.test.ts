import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({ select: vi.fn() }));
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const requireReportMock = vi.hoisted(() => vi.fn());
const complianceMock = vi.hoisted(() => vi.fn());
const loadDisputeChainMock = vi.hoisted(() => vi.fn());
const decideEscalationMock = vi.hoisted(() => vi.fn());
const generateLetterMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/parser-review-gate', () => ({ requireLatestApprovedReportForClient: requireReportMock }));
vi.mock('@/lib/dispute-compliance-policy', () => ({ evaluateDisputeCompliance: complianceMock }));
vi.mock('@/lib/dispute-escalation-decision', () => ({ loadDisputeChain: loadDisputeChainMock, decideEscalation: decideEscalationMock }));
vi.mock('@/lib/ai-letter-generator', () => ({ generateUniqueDisputeLetter: generateLetterMock }));
vi.mock('@/lib/letter-generation-library', () => ({ selectLibraryForGeneration: vi.fn() }));
vi.mock('@/lib/dispute-draft-generator', () => ({ persistGeneratedDisputeDraft: vi.fn() }));
vi.mock('@/lib/rate-limit-middleware', () => ({ rateLimited: () => (handler: unknown) => handler }));
vi.mock('@/lib/rate-limit', () => ({ sensitiveLimiter: {} }));

function query(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(rows),
      })),
    })),
  };
}

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/workspace/disputes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const baseBody = {
  clientId: 'client-1',
  bureau: 'experian',
  disputeReason: 'CFPB complaint packet',
  targetRecipient: 'cfpb',
  priorDisputeId: 'cra-1',
  negativeItemId: 'item-1',
  reasonCodes: ['fcra_non_compliance'],
};

describe('POST /api/workspace/disputes CFPB gate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
    requireReportMock.mockResolvedValue({ allowed: true });
    complianceMock.mockReturnValue({ isCompliant: true, violations: [] });
    dbMock.select
      .mockReturnValueOnce(query([{ id: 'client-1', firstName: 'Jane', lastName: 'Client' }]))
      .mockReturnValueOnce(query([{ id: 'item-1', creditorName: 'Example Bank', originalCreditor: null, itemType: 'collection', amount: 100, creditAccountId: null, dateReported: null }]));
  });

  it('requires exactly one selected item', async () => {
    const { POST } = await import('@/app/api/workspace/disputes/route');

    const response = await POST(request({ ...baseBody, negativeItemId: null }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ reason: 'one_item_required' });
    expect(loadDisputeChainMock).not.toHaveBeenCalled();
    expect(generateLetterMock).not.toHaveBeenCalled();
  });

  it('returns the predecessor eligibility decision before generating', async () => {
    loadDisputeChainMock.mockResolvedValue([{ id: 'cra-1', clientId: 'client-1', negativeItemId: 'item-1', targetRecipient: 'bureau', sentAt: new Date('2026-07-20T00:00:00.000Z') }]);
    decideEscalationMock.mockReturnValue({
      kind: 'blocked',
      message: 'CFPB escalation is deferred until 2026-09-03T00:00:00.000Z.',
      eligibility: { eligible: false, reason: 'still_pending', eligibleAt: new Date('2026-09-03T00:00:00.000Z') },
    });
    const { POST } = await import('@/app/api/workspace/disputes/route');

    const response = await POST(request(baseBody));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ reason: 'still_pending', eligible_at: '2026-09-03T00:00:00.000Z' });
    expect(generateLetterMock).not.toHaveBeenCalled();
  });

  it('rejects a predecessor whose CRA item does not match the selected item', async () => {
    loadDisputeChainMock.mockResolvedValue([{ id: 'cra-1', clientId: 'client-1', negativeItemId: 'different-item', targetRecipient: 'bureau', sentAt: new Date('2026-06-01T00:00:00.000Z') }]);
    decideEscalationMock.mockReturnValue({ kind: 'ready', plan: { targetRecipient: 'cfpb' }, eligibility: { eligible: true, reason: 'eligible', eligibleAt: null } });
    const { POST } = await import('@/app/api/workspace/disputes/route');

    const response = await POST(request(baseBody));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({ error: 'The prior CRA dispute does not match this client and item' });
    expect(generateLetterMock).not.toHaveBeenCalled();
  });
});

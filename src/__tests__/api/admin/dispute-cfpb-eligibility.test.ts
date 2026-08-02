import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireCapabilityMock = vi.hoisted(() => vi.fn());
const loadDisputeChainMock = vi.hoisted(() => vi.fn());
const decideEscalationMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/dispute-escalation-decision', () => ({
  decideEscalation: decideEscalationMock,
  loadDisputeChain: loadDisputeChainMock,
}));

describe('GET /api/admin/disputes/[id]/cfpb-eligibility', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'admin' });
  });

  it('returns the pending reason and eligibility date for a matching CRA dispute', async () => {
    loadDisputeChainMock.mockResolvedValue([{
      id: 'cra-dispute-1',
      clientId: 'client-1',
      negativeItemId: 'item-1',
      priorDisputeId: null,
      targetRecipient: 'bureau',
      status: 'sent',
      sentAt: new Date('2026-07-01T00:00:00.000Z'),
      responseReceivedAt: null,
    }]);
    decideEscalationMock.mockReturnValue({
      kind: 'blocked',
      plan: { targetRecipient: 'cfpb' },
      eligibility: {
        eligible: false,
        reason: 'still_pending',
        eligibleAt: new Date('2026-08-15T00:00:00.000Z'),
      },
      message: 'CFPB escalation is deferred until 2026-08-15T00:00:00.000Z.',
    });

    const { GET } = await import('@/app/api/admin/disputes/[id]/cfpb-eligibility/route');
    const response = await GET(
      new NextRequest('http://localhost/api/admin/disputes/cra-dispute-1/cfpb-eligibility?clientId=client-1&negativeItemId=item-1'),
      { params: Promise.resolve({ id: 'cra-dispute-1' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      eligible: false,
      reason: 'still_pending',
      eligible_at: '2026-08-15T00:00:00.000Z',
    });
  });
});

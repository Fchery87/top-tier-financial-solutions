import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

const requireCapabilityMock = vi.hoisted(() => vi.fn());
const selectLibraryForGenerationMock = vi.hoisted(() => vi.fn());
const requireLatestApprovedReportForClientMock = vi.hoisted(() => vi.fn());
const generateUniqueDisputeLetterMock = vi.hoisted(() => vi.fn());
const persistGeneratedDisputeDraftMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/letter-generation-library', () => ({ selectLibraryForGeneration: selectLibraryForGenerationMock }));
vi.mock('@/lib/parser-review-gate', () => ({ requireLatestApprovedReportForClient: requireLatestApprovedReportForClientMock }));
vi.mock('@/lib/ai-letter-generator', () => ({ generateUniqueDisputeLetter: generateUniqueDisputeLetterMock }));
vi.mock('@/lib/dispute-draft-generator', () => ({ persistGeneratedDisputeDraft: persistGeneratedDisputeDraftMock }));
vi.mock('@/lib/dispute-escalation-decision', () => ({
  decideEscalation: vi.fn(),
  loadDisputeChain: vi.fn(),
}));

function selectResult(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

describe('POST /api/workspace/disputes/[id]/quick-redispute', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'admin-1' });
    requireLatestApprovedReportForClientMock.mockResolvedValue({ allowed: true });
    selectLibraryForGenerationMock.mockResolvedValue({ selection: 'fixture' });
    generateUniqueDisputeLetterMock.mockResolvedValue('Generated letter');
    persistGeneratedDisputeDraftMock.mockResolvedValue({ disputeId: 'draft-1' });
  });

  it('rejects a no-response draft before the response deadline', async () => {
    const { POST } = await import('@/app/api/workspace/disputes/[id]/quick-redispute/route');
    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{
      id: 'dispute-1',
      outcome: 'no_response',
      responseDeadline: new Date('2099-02-01T00:00:00.000Z'),
      responseReceivedAt: null,
      responseDocumentUrl: null,
    }]) }) }) });

    const response = await POST(
      new NextRequest('http://localhost/api/workspace/disputes/dispute-1/quick-redispute', { method: 'POST' }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'No-response escalation is available only after the response deadline has elapsed',
    });
  });

  it.each([
    { outcome: 'verified', responseReceivedAt: new Date('2026-02-01T00:00:00.000Z'), responseDocumentUrl: 'https://files.example/verified.pdf' },
    { outcome: 'no_response', responseReceivedAt: null, responseDocumentUrl: null },
  ] as const)('creates a Round 2 draft after an eligible $outcome response review', async ({ outcome, responseReceivedAt, responseDocumentUrl }) => {
    const { POST } = await import('@/app/api/workspace/disputes/[id]/quick-redispute/route');
    const currentDispute = {
      id: 'dispute-1',
      clientId: 'client-1',
      negativeItemId: 'item-1',
      bureau: 'experian',
      round: 1,
      outcome,
      responseDeadline: new Date('2026-02-01T00:00:00.000Z'),
      responseReceivedAt,
      responseDocumentUrl,
      analysisConfidence: null,
      autoSelected: false,
    };
    dbMock.select
      .mockReturnValueOnce(selectResult([currentDispute]))
      .mockReturnValueOnce(selectResult([]))
      .mockReturnValueOnce(selectResult([{ id: 'client-1', firstName: 'Test', lastName: 'Client' }]))
      .mockReturnValueOnce(selectResult([{
        id: 'item-1',
        creditorName: 'Fixture Bank',
        originalCreditor: null,
        creditAccountId: null,
        itemType: 'collection',
        amount: null,
        dateReported: null,
      }]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })
      .mockReturnValueOnce(selectResult([{
        id: 'draft-1',
        round: 2,
        disputeType: 'method_of_verification',
        status: 'draft',
      }]));

    const response = await POST(
      new NextRequest('http://localhost/api/workspace/disputes/dispute-1/quick-redispute', { method: 'POST' }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: 'Escalation dispute created',
      dispute: {
        id: 'draft-1',
        round: 2,
        dispute_type: 'method_of_verification',
        status: 'draft',
      },
    });
    expect(generateUniqueDisputeLetterMock).toHaveBeenCalledWith(expect.objectContaining({
      round: 2,
      targetRecipient: 'bureau',
      disputeType: 'method_of_verification',
    }));
    expect(persistGeneratedDisputeDraftMock).toHaveBeenCalledWith(expect.objectContaining({
      round: 2,
      priorDisputeId: 'dispute-1',
      policyDecision: expect.objectContaining({
        approved: true,
        reasonCodes: expect.arrayContaining(['request_verification_method']),
        claimRisk: 'ordinary',
      }),
    }));
  });


  it('refuses a next-cycle draft while the prior dispute packet awaits client confirmation', async () => {
    const { POST } = await import('@/app/api/workspace/disputes/[id]/quick-redispute/route');
    dbMock.select
      .mockReturnValueOnce(selectResult([{
        id: 'dispute-1',
        clientId: 'client-1',
        negativeItemId: 'item-1',
        bureau: 'experian',
        round: 1,
        outcome: 'no_response',
        responseDeadline: new Date('2026-02-01T00:00:00.000Z'),
        responseReceivedAt: null,
        responseDocumentUrl: null,
      }]))
      .mockReturnValueOnce(selectResult([]))
      .mockReturnValueOnce(selectResult([{ id: 'client-1', firstName: 'Test', lastName: 'Client' }]))
      .mockReturnValueOnce(selectResult([{
        id: 'item-1',
        creditorName: 'Fixture Bank',
        originalCreditor: null,
        creditAccountId: null,
        itemType: 'collection',
        amount: null,
        dateReported: null,
      }]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            claimType: 'identity_theft',
            confirmations: JSON.stringify([{ key: 'client_authorized_review', confirmed: true }]),
          }]),
        }),
      });

    const response = await POST(
      new NextRequest('http://localhost/api/workspace/disputes/dispute-1/quick-redispute', { method: 'POST' }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'High-risk evidence packet is awaiting client confirmation',
    });
    expect(generateUniqueDisputeLetterMock).not.toHaveBeenCalled();
  });

  it('rejects verified drafts without recorded response evidence', async () => {
    const { POST } = await import('@/app/api/workspace/disputes/[id]/quick-redispute/route');
    dbMock.select.mockReturnValue(selectResult([{
      id: 'dispute-1',
      outcome: 'verified',
      responseDeadline: new Date('2026-02-01T00:00:00.000Z'),
      responseReceivedAt: null,
      responseDocumentUrl: null,
    }]));

    const response = await POST(
      new NextRequest('http://localhost/api/workspace/disputes/dispute-1/quick-redispute', { method: 'POST' }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Verified escalation requires a completed response review with evidence',
    });
  });
});

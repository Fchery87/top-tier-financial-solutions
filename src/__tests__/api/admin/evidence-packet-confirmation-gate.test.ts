import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
}));

const requireCapabilityMock = vi.hoisted(() => vi.fn());
const generateUniqueDisputeLetterMock = vi.hoisted(() => vi.fn());
const requireLatestApprovedReportForClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/admin-session', () => ({
  requireCapability: requireCapabilityMock,
}));

vi.mock('@/lib/ai-letter-generator', () => ({
  DISPUTE_REASON_CODES: [],
  generateUniqueDisputeLetter: generateUniqueDisputeLetterMock,
  generateMultiItemDisputeLetter: vi.fn(),
}));

vi.mock('@/lib/parser-review-gate', () => ({
  requireLatestApprovedReportForClient: requireLatestApprovedReportForClientMock,
}));

vi.mock('@/lib/letter-generation-library', () => ({
  selectLibraryForGeneration: vi.fn(),
}));

vi.mock('@/lib/dispute-draft-generator', () => ({
  persistGeneratedDisputeDraft: vi.fn(),
}));

function rows(result: unknown[]) {
  const where = vi.fn().mockImplementation(() => {
    const query = Promise.resolve(result) as Promise<unknown[]> & { limit: ReturnType<typeof vi.fn> };
    query.limit = vi.fn().mockResolvedValue(result);
    return query;
  });
  return { from: vi.fn().mockReturnValue({ where }) };
}

const approvedRequest = {
  clientId: 'client-1',
  disputeId: 'dispute-1',
  bureau: 'experian',
  reasonCodes: ['verification_required'],
  evidenceDocumentIds: [],
  clientConfirmedOwnershipClaims: false,
  policyDecision: {
    approved: true,
    reasonCodes: ['verification_required'],
    requiredEvidence: ['identity_document', 'proof_of_address'],
    claimRisk: 'ordinary',
    targetRecipient: 'bureau',
    violations: [],
  },
};

describe('high-risk confirmation gates', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'staff-1', email: 'staff@example.com', role: 'staff' });
    requireLatestApprovedReportForClientMock.mockResolvedValue({ allowed: true });
  });

  it('refuses letter generation while a packet is awaiting client confirmation', async () => {
    dbMock.select.mockReturnValueOnce(rows([{
      claimType: 'identity_theft',
      documentIds: JSON.stringify(['doc-1']),
      confirmations: JSON.stringify([{ key: 'client_authorized_review', confirmed: true }]),
    }]));

    const { POST } = await import('@/app/api/admin/disputes/generate-letter/route');
    const response = await POST(new NextRequest('http://localhost/api/admin/disputes/generate-letter', {
      method: 'POST',
      body: JSON.stringify(approvedRequest),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'High-risk evidence packet is awaiting client confirmation',
    });
    expect(generateUniqueDisputeLetterMock).not.toHaveBeenCalled();
  });

  it('does not treat an empty packet list as awaiting confirmation', async () => {
    dbMock.select.mockReturnValueOnce(rows([]));
    requireLatestApprovedReportForClientMock.mockResolvedValue({
      allowed: false,
      reason: 'The latest credit report must be approved before letter generation.',
    });

    const { POST } = await import('@/app/api/admin/disputes/generate-letter/route');
    const response = await POST(new NextRequest('http://localhost/api/admin/disputes/generate-letter', {
      method: 'POST',
      body: JSON.stringify(approvedRequest),
    }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'The latest credit report must be approved before letter generation.',
    });
    expect(generateUniqueDisputeLetterMock).not.toHaveBeenCalled();
  });

  it('refuses marking a dispute sent while a packet is awaiting client confirmation', async () => {
    dbMock.select
      .mockReturnValueOnce(rows([{
        id: 'dispute-1',
        clientId: 'client-1',
        negativeItemId: null,
        sentAt: null,
        escalationHistory: null,
      }]))
      .mockReturnValueOnce(rows([{
        claimType: 'fraud',
        documentIds: JSON.stringify(['doc-1']),
        confirmations: JSON.stringify([]),
      }]));

    const { PUT } = await import('@/app/api/admin/disputes/[id]/route');
    const response = await PUT(new NextRequest('http://localhost/api/admin/disputes/dispute-1', {
      method: 'PUT',
      body: JSON.stringify({
        status: 'sent',
        sentAt: '2026-02-01T00:00:00.000Z',
        submissionMethod: 'certified_mail',
        submissionRecipient: 'experian',
      }),
    }), { params: Promise.resolve({ id: 'dispute-1' }) });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'High-risk evidence packet is awaiting client confirmation',
    });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('does not block sent status when the dispute has no awaiting packet', async () => {
    dbMock.select
      .mockReturnValueOnce(rows([{
        id: 'dispute-1',
        clientId: 'client-1',
        negativeItemId: null,
        sentAt: null,
        escalationHistory: null,
      }]))
      .mockReturnValueOnce(rows([]));

    const { PUT } = await import('@/app/api/admin/disputes/[id]/route');
    const response = await PUT(new NextRequest('http://localhost/api/admin/disputes/dispute-1', {
      method: 'PUT',
      body: JSON.stringify({ status: 'sent' }),
    }), { params: Promise.resolve({ id: 'dispute-1' }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Submission tracking is required before marking a dispute submitted',
    });
  });
});

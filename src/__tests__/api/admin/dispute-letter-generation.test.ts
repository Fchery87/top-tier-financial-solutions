import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

const adminSessionMock = vi.hoisted(() => vi.fn());
const generateUniqueDisputeLetterMock = vi.hoisted(() => vi.fn());
const generateMultiItemDisputeLetterMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/admin-session', () => ({
  getAdminSessionUser: adminSessionMock,
}));

vi.mock('@/lib/ai-letter-generator', () => ({
  DISPUTE_REASON_CODES: [],
  generateUniqueDisputeLetter: generateUniqueDisputeLetterMock,
  generateMultiItemDisputeLetter: generateMultiItemDisputeLetterMock,
}));

describe('POST /api/admin/disputes/generate-letter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminSessionMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
  });

  it('fails closed when approved policy inputs are missing', async () => {
    const { POST } = await import('@/app/api/admin/disputes/generate-letter/route');

    const response = await POST(new NextRequest('http://localhost/api/admin/disputes/generate-letter', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        bureau: 'experian',
        reasonCodes: ['verification_required'],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Approved policy decision is required before letter generation' });
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(generateUniqueDisputeLetterMock).not.toHaveBeenCalled();
    expect(generateMultiItemDisputeLetterMock).not.toHaveBeenCalled();
  }, 30000);

  it('rejects approved policy decisions that do not match the requested reason codes', async () => {
    const { POST } = await import('@/app/api/admin/disputes/generate-letter/route');

    const response = await POST(new NextRequest('http://localhost/api/admin/disputes/generate-letter', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        bureau: 'experian',
        reasonCodes: ['never_late'],
        evidenceDocumentIds: ['doc-1'],
        clientConfirmedOwnershipClaims: true,
        policyDecision: {
          approved: true,
          reasonCodes: ['verification_required'],
          requiredEvidence: ['identity_document', 'proof_of_address'],
          claimRisk: 'ordinary',
          targetRecipient: 'bureau',
          violations: [],
        },
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Approved policy decision does not match requested dispute inputs' });
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(generateUniqueDisputeLetterMock).not.toHaveBeenCalled();
    expect(generateMultiItemDisputeLetterMock).not.toHaveBeenCalled();
  }, 30000);
});

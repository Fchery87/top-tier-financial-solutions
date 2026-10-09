import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

const requireCapabilityMock = vi.hoisted(() => vi.fn());
const generateUniqueDisputeLetterMock = vi.hoisted(() => vi.fn());
const generateMultiItemDisputeLetterMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/admin-session', () => ({
  requireCapability: requireCapabilityMock,
}));

vi.mock('@/lib/ai-letter-generator', () => ({
  DISPUTE_REASON_CODES: [],
  generateUniqueDisputeLetter: generateUniqueDisputeLetterMock,
  generateMultiItemDisputeLetter: generateMultiItemDisputeLetterMock,
}));

describe('POST /api/workspace/disputes/generate-letter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
  });

  it('decides policy on the server and refuses a high-risk claim that names no item', async () => {
    const { POST } = await import('@/app/api/workspace/disputes/generate-letter/route');

    const response = await POST(new NextRequest('http://localhost/api/workspace/disputes/generate-letter', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        bureau: 'experian',
        reasonCodes: ['never_late'],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: 'Client confirmation is required for high-risk claims',
      code: 'HIGH_RISK_CONFIRMATION_REQUIRED',
      items: [{ itemId: null, itemKind: null, claimType: 'never_late', state: 'no_packet' }],
    });
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(generateUniqueDisputeLetterMock).not.toHaveBeenCalled();
    expect(generateMultiItemDisputeLetterMock).not.toHaveBeenCalled();
  }, 30000);

  it('ignores a caller-supplied approved policyDecision that contradicts the request', async () => {
    const { POST } = await import('@/app/api/workspace/disputes/generate-letter/route');

    const response = await POST(new NextRequest('http://localhost/api/workspace/disputes/generate-letter', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        bureau: 'experian',
        reasonCodes: ['never_late'],
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

    expect(response.status).toBe(409);
    expect(body).toEqual({
      error: 'Client confirmation is required for high-risk claims',
      code: 'HIGH_RISK_CONFIRMATION_REQUIRED',
      items: [{ itemId: null, itemKind: null, claimType: 'never_late', state: 'no_packet' }],
    });
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(generateUniqueDisputeLetterMock).not.toHaveBeenCalled();
    expect(generateMultiItemDisputeLetterMock).not.toHaveBeenCalled();
  }, 30000);
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

const adminSessionMock = vi.hoisted(() => vi.fn());
const generateUniqueDisputeLetterMock = vi.hoisted(() => vi.fn());
const requireLatestApprovedReportForClientMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/parser-review-gate', () => ({
  requireLatestApprovedReportForClient: requireLatestApprovedReportForClientMock,
}));

vi.mock('@/lib/admin-session', () => ({
  getAdminSessionUser: adminSessionMock,
}));

vi.mock('@/lib/ai-letter-generator', () => ({
  generateUniqueDisputeLetter: generateUniqueDisputeLetterMock,
}));

vi.mock('@/lib/rate-limit-middleware', () => ({
  rateLimited: () => (handler: unknown) => handler,
}));

vi.mock('@/lib/rate-limit', () => ({
  sensitiveLimiter: {},
}));

vi.mock('@/lib/db-encryption', () => ({
  decryptDisputeData: (data: unknown) => data,
  decryptClientData: (data: unknown) => data,
}));

describe('POST /api/admin/disputes policy traceability', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminSessionMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
    generateUniqueDisputeLetterMock.mockResolvedValue('Generated approved dispute letter');
    requireLatestApprovedReportForClientMock.mockResolvedValue({
      allowed: true,
      reportId: 'report-1',
      parseStatus: 'completed',
      parserReviewStatus: 'approved',
    });
  });

  it('persists approved policy decision inputs with generated letter content', async () => {
    const { POST } = await import('@/app/api/admin/disputes/route');
    const insertedValues: Record<string, unknown>[] = [];
    const createdDispute = {
      id: 'dispute-1',
      clientId: 'client-1',
      negativeItemId: null,
      bureau: 'experian',
      disputeReason: 'verification_required',
      disputeType: 'standard',
      status: 'draft',
      round: 1,
      letterContent: 'Generated approved dispute letter',
      trackingNumber: null,
      sentAt: null,
      responseDeadline: null,
      reasonCodes: JSON.stringify(['verification_required']),
      policyDecision: JSON.stringify({
        approved: true,
        reasonCodes: ['verification_required'],
        requiredEvidence: ['identity_document', 'proof_of_address'],
        claimRisk: 'ordinary',
        targetRecipient: 'bureau',
        violations: [],
      }),
      analysisConfidence: null,
      autoSelected: false,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1', firstName: 'Jane', lastName: 'Client' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([createdDispute]) }) }) });
    dbMock.insert.mockReturnValue({ values: vi.fn((values) => { insertedValues.push(values); return Promise.resolve(); }) });

    const policyDecision = {
      approved: true,
      reasonCodes: ['verification_required'],
      requiredEvidence: ['identity_document', 'proof_of_address'],
      claimRisk: 'ordinary',
      targetRecipient: 'bureau',
      violations: [],
    };

    const response = await POST(new NextRequest('http://localhost/api/admin/disputes', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        bureau: 'experian',
        disputeReason: 'verification_required',
        reasonCodes: ['verification_required'],
        policyDecision,
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(insertedValues[0]).toMatchObject({
      letterContent: 'Generated approved dispute letter',
      reasonCodes: JSON.stringify(['verification_required']),
      policyDecision: JSON.stringify(policyDecision),
    });
    expect(body).toMatchObject({
      id: 'dispute-1',
      policy_decision: policyDecision,
      letter_content: 'Generated approved dispute letter',
    });
  }, 30000);

  it('fails closed before generating a letter when approved policy is missing', async () => {
    const { POST } = await import('@/app/api/admin/disputes/route');

    const response = await POST(new NextRequest('http://localhost/api/admin/disputes', {
      method: 'POST',
      body: JSON.stringify({
        clientId: 'client-1',
        bureau: 'experian',
        disputeReason: 'verification_required',
        reasonCodes: ['verification_required'],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Approved policy decision is required before dispute letter generation' });
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
    expect(generateUniqueDisputeLetterMock).not.toHaveBeenCalled();
  }, 30000);
});

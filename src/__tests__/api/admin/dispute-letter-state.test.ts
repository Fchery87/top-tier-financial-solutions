import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })) }));
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const saveDisputeLetterMock = vi.hoisted(() => vi.fn());
const recordSensitiveReadMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/dispute-letter-workflow', () => ({ saveDisputeLetter: saveDisputeLetterMock }));
vi.mock('@/lib/sensitive-read-audit', () => ({ recordSensitiveRead: recordSensitiveReadMock }));

const dispute = {
  id: 'dispute-1',
  letterContent: 'Current letter for Acme Bank.',
  status: 'draft',
  sentAt: null,
  letterTemplateId: 'library-1',
  reasonCodes: JSON.stringify(['verification_required']),
  creditorName: 'Acme Bank',
  accountNumber: '****1234',
  bureau: 'experian',
  letterContextSnapshot: null,
};

function query(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  requireCapabilityMock.mockResolvedValue({ id: 'operator-1', email: 'operator@example.com', role: 'staff' });
  saveDisputeLetterMock.mockResolvedValue({
    kind: 'saved',
    content: 'Reverted letter.',
    revision: 3,
    updatedAt: new Date('2026-08-02T00:00:00Z'),
    findings: [],
  });
  recordSensitiveReadMock.mockResolvedValue(undefined);
});

describe('Letter Studio state routes', () => {
  it('returns the current letter, lint, library attribution, and revision history', async () => {
    dbMock.select
      .mockReturnValueOnce(query([dispute]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([{
              id: 'revision-2', revision: 2, source: 'manual', toneLabel: null,
              warningsAcknowledged: false, acknowledgedBy: null, createdBy: 'operator-1',
              createdAt: new Date('2026-08-02T00:00:00Z'), content: dispute.letterContent,
              lintFindings: '[]', generationMetadata: null,
            }]),
          }),
        }),
      })
      .mockReturnValueOnce(query([{ id: 'library-1', name: 'Factual strategy', methodology: 'factual', targetRecipient: 'bureau' }]));

    const { GET } = await import('@/app/api/workspace/disputes/[id]/letter/route');
    const response = await GET(new NextRequest('http://localhost/api/workspace/disputes/dispute-1/letter', {
      headers: { 'x-request-id': 'request-1' },
    }), { params: Promise.resolve({ id: 'dispute-1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ dispute_id: 'dispute-1', content: dispute.letterContent, current_revision: 2 });
    expect(body.library).toMatchObject({ id: 'library-1', name: 'Factual strategy' });
    expect(body.revisions).toHaveLength(1);
    expect(recordSensitiveReadMock).toHaveBeenCalledTimes(1);
    expect(recordSensitiveReadMock).toHaveBeenCalledWith(dbMock, {
      kind: 'dispute_letter',
      actorUserId: 'operator-1',
      disputeId: 'dispute-1',
      route: '/api/workspace/disputes/dispute-1/letter',
      requestId: 'request-1',
    });
    expect(JSON.stringify(recordSensitiveReadMock.mock.calls)).not.toContain(dispute.letterContent);
  });

  it('fails closed before returning letter content when the audit write fails', async () => {
    dbMock.select.mockReturnValueOnce(query([dispute]));
    recordSensitiveReadMock.mockRejectedValueOnce(new Error('audit unavailable'));
    const { GET } = await import('@/app/api/workspace/disputes/[id]/letter/route');

    const response = await GET(new NextRequest('http://localhost/api/workspace/disputes/dispute-1/letter', {
      headers: { 'x-request-id': 'request-1' },
    }), { params: Promise.resolve({ id: 'dispute-1' }) });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to load letter state' });
  });

  it('runs preview lint through the letters capability without persisting', async () => {
    dbMock.select.mockReturnValueOnce(query([dispute]));
    const { POST } = await import('@/app/api/workspace/disputes/[id]/letter/lint/route');

    const response = await POST(new NextRequest('http://localhost/api/workspace/disputes/dispute-1/letter/lint', {
      method: 'POST',
      body: JSON.stringify({ content: dispute.letterContent }),
    }), { params: Promise.resolve({ id: 'dispute-1' }) });

    expect(response.status).toBe(200);
    expect((await response.json()).preview).toBe(true);
  });

  it('reverts by creating a new revision through the workflow seam', async () => {
    dbMock.select.mockReturnValueOnce(query([{ id: 'revision-1', disputeId: 'dispute-1', content: 'Earlier letter.' }]));
    const { POST } = await import('@/app/api/workspace/disputes/[id]/letter/revisions/[revisionId]/revert/route');

    const response = await POST(new NextRequest('http://localhost/api/workspace/disputes/dispute-1/letter/revisions/revision-1/revert', {
      method: 'POST', body: JSON.stringify({ expectedRevision: 2 }),
    }), { params: Promise.resolve({ id: 'dispute-1', revisionId: 'revision-1' }) });

    expect(response.status).toBe(200);
    expect(saveDisputeLetterMock).toHaveBeenCalledWith(expect.objectContaining({
      disputeId: 'dispute-1', content: 'Earlier letter.', source: 'revert', expectedRevision: 2,
    }));
  });
});

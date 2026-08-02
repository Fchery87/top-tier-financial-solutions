import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
  execute: vi.fn(),
}));
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const rewriteLetterMock = vi.hoisted(() => vi.fn());
const recordLetterRevisionMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/letter-rewriter', () => ({
  rewriteLetter: rewriteLetterMock,
  buildRewritePrompt: vi.fn(() => 'rewrite prompt'),
}));
vi.mock('@/lib/dispute-letter-revisions', () => ({ recordLetterRevision: recordLetterRevisionMock }));

const dispute = {
  id: 'dispute-1',
  clientId: 'client-1',
  negativeItemId: 'item-1',
  bureau: 'experian',
  round: 1,
  status: 'draft',
  sentAt: null,
  letterContent: 'Original letter for Example Creditor.',
  reasonCodes: JSON.stringify(['verification_required']),
  creditorName: 'Example Creditor',
  accountNumber: '****4321',
};

const negativeItem = {
  id: 'item-1',
  creditorName: 'Example Creditor',
  originalCreditor: null,
  itemType: 'collection',
  bureau: 'experian',
};

function mockDisputeQueries() {
  dbMock.select
    .mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([dispute]),
        }),
      }),
    })
    .mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([negativeItem]),
        }),
      }),
    })
    .mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ revision: 1 }]),
          }),
        }),
      }),
    });
}

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/admin/disputes/dispute-1/letter/rewrite', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  requireCapabilityMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'admin' });
  dbMock.update.mockReturnValue({
    set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  });
  dbMock.transaction.mockImplementation(async (operation: (executor: typeof dbMock) => Promise<unknown>) => operation(dbMock));
  dbMock.execute.mockResolvedValue({ rows: [{ ...dispute, sent_at: null, letter_content: dispute.letterContent, reason_codes: dispute.reasonCodes, creditor_name: dispute.creditorName, original_creditor: null, account_number: dispute.accountNumber, letter_context_snapshot: null }] });
  dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
  recordLetterRevisionMock.mockResolvedValue(undefined);
});

describe('POST /api/admin/disputes/[id]/letter/rewrite', () => {
  it('does not persist a rewrite that fabricates source data', async () => {
    mockDisputeQueries();
    rewriteLetterMock.mockResolvedValue({
      letter: 'Creditor Name: Fabricated Corp',
      blocked: true,
      findings: [{ code: 'unknown_creditor', severity: 'block', message: 'Unknown creditor.' }],
      attempts: 2,
    });

    const { POST } = await import('@/app/api/admin/disputes/[id]/letter/rewrite/route');
    const response = await POST(request({ mode: 'rewrite' }), { params: Promise.resolve({ id: 'dispute-1' }) });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.findings[0].code).toBe('unknown_creditor');
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(recordLetterRevisionMock).not.toHaveBeenCalled();
  });

  it('requires acknowledgement before persisting warning findings', async () => {
    mockDisputeQueries();
    rewriteLetterMock.mockResolvedValue({
      letter: 'I will pursue legal action.',
      blocked: false,
      findings: [{ code: 'threat_language', severity: 'warn', message: 'Threat language.' }],
      attempts: 1,
    });

    const { POST } = await import('@/app/api/admin/disputes/[id]/letter/rewrite/route');
    const response = await POST(request({ mode: 'tone', tone: 'demanding' }), { params: Promise.resolve({ id: 'dispute-1' }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('needs_acknowledgement');
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it('persists an acknowledged rewrite and records its revision', async () => {
    mockDisputeQueries();
    rewriteLetterMock.mockResolvedValue({
      letter: 'Please investigate Example Creditor and provide the verification results.',
      blocked: false,
      findings: [{ code: 'statute_not_allowlisted', severity: 'warn', message: 'Review authority.' }],
      attempts: 1,
    });

    const { POST } = await import('@/app/api/admin/disputes/[id]/letter/rewrite/route');
    const response = await POST(request({ mode: 'custom', instruction: 'Make the request clearer.', acknowledgeWarnings: true }), { params: Promise.resolve({ id: 'dispute-1' }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.letter).toContain('Example Creditor');
    expect(dbMock.update).toHaveBeenCalledOnce();
    expect(dbMock.insert).toHaveBeenCalledOnce();
    expect(recordLetterRevisionMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({ select: vi.fn() }));
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const recordSensitiveReadMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/sensitive-read-audit', () => ({ recordSensitiveRead: recordSensitiveReadMock }));
vi.mock('@/lib/db-encryption', () => ({
  decryptClientData: vi.fn(() => ({ firstName: 'First', lastName: 'Last', phone: null })),
  decryptCreditAccountData: vi.fn(() => ({ creditorName: 'Creditor' })),
  decryptNegativeItemData: vi.fn(() => ({ creditorName: 'Creditor' })),
  decryptDisputeData: vi.fn(() => ({ creditorName: 'Creditor' })),
  encryptClientData: vi.fn(() => ({})),
}));
vi.mock('@/lib/audit-report', () => ({
  calculateProjectedScoreIncrease: vi.fn(() => 0),
  generateAuditReportHTML: vi.fn(() => '<html>private report</html>'),
}));

const client = {
  id: 'client-1',
  userId: null,
  leadId: null,
  firstName: 'encrypted-first',
  lastName: 'encrypted-last',
  email: 'client@example.com',
  phone: null,
  status: 'active',
  notes: 'private notes',
  convertedAt: null,
  createdAt: new Date('2026-08-01T00:00:00Z'),
  updatedAt: new Date('2026-08-01T00:00:00Z'),
  userName: null,
  userEmail: null,
};

function terminal(rows: unknown[]) {
  const result = Promise.resolve(rows);
  return Object.assign(result, {
    limit: vi.fn(() => result),
    orderBy: vi.fn(() => result),
  });
}

function standardSelect(rows: unknown[] = []) {
  return {
    from: vi.fn(() => ({ where: vi.fn(() => terminal(rows)) })),
  };
}

function clientSelect() {
  return {
    from: vi.fn(() => ({
      leftJoin: vi.fn(() => ({ where: vi.fn(() => terminal([client])) })),
    })),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  requireCapabilityMock.mockResolvedValue({ id: 'operator-1' });
  recordSensitiveReadMock.mockResolvedValue(undefined);
  dbMock.select.mockReturnValueOnce(clientSelect()).mockImplementation(() => standardSelect());
});

describe('client sensitive-read audit routes', () => {
  it('audits a successful client record read without passing protected fields', async () => {
    const { GET } = await import('@/app/api/admin/clients/[id]/route');
    const response = await GET(new NextRequest('http://localhost/api/admin/clients/client-1', {
      headers: { 'x-request-id': 'request-1' },
    }), { params: Promise.resolve({ id: 'client-1' }) });

    expect(response.status).toBe(200);
    expect(recordSensitiveReadMock).toHaveBeenCalledOnce();
    expect(recordSensitiveReadMock).toHaveBeenCalledWith(dbMock, {
      kind: 'client_record',
      actorUserId: 'operator-1',
      clientId: 'client-1',
      route: '/api/admin/clients/client-1',
      requestId: 'request-1',
    });
    expect(JSON.stringify(recordSensitiveReadMock.mock.calls)).not.toContain(client.email);
    expect(JSON.stringify(recordSensitiveReadMock.mock.calls)).not.toContain(client.notes);
  });

  it('audits an audit-report preview without passing report HTML or client fields', async () => {
    dbMock.select.mockReset();
    dbMock.select.mockReturnValueOnce(standardSelect([client])).mockImplementation(() => standardSelect());
    const { GET } = await import('@/app/api/admin/clients/[id]/audit-report/route');
    const response = await GET(new NextRequest('http://localhost/api/admin/clients/client-1/audit-report?type=simple', {
      headers: { 'x-request-id': 'request-2' },
    }), { params: Promise.resolve({ id: 'client-1' }) });

    expect(response.status).toBe(200);
    expect(recordSensitiveReadMock).toHaveBeenCalledOnce();
    expect(recordSensitiveReadMock).toHaveBeenCalledWith(dbMock, {
      kind: 'client_record',
      actorUserId: 'operator-1',
      clientId: 'client-1',
      route: '/api/admin/clients/client-1/audit-report',
      requestId: 'request-2',
    });
    expect(JSON.stringify(recordSensitiveReadMock.mock.calls)).not.toContain(client.email);
    expect(JSON.stringify(recordSensitiveReadMock.mock.calls)).not.toContain('private report');
  });
});

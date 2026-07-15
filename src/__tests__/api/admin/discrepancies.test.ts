import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  api: {
    getSession: vi.fn(),
  },
}));

const adminAuthMock = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(),
}));

const drizzleOrmMock = vi.hoisted(() => ({
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  isNull: vi.fn((...args: unknown[]) => ({ op: 'isNull', args })),
}));

function mockDiscrepancyQuery(rows: unknown[]) {
  dbMock.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  });
}

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/admin-auth', () => adminAuthMock);

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  eq: drizzleOrmMock.eq,
  and: drizzleOrmMock.and,
  isNull: drizzleOrmMock.isNull,
}));

describe('GET /api/admin/disputes/discrepancies', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@example.com' } });
    adminAuthMock.isSuperAdmin.mockResolvedValue(true);
  });

  it('keeps clientId-only behavior while allowing optional reportId filtering', async () => {
    const { GET } = await import('@/app/api/admin/disputes/discrepancies/route');

    mockDiscrepancyQuery([
      {
        id: 'disc-1',
        clientId: 'client-1',
        creditReportId: 'report-a',
        discrepancyType: 'account_balance',
        field: 'balance',
        creditorName: 'Capital Bank',
        accountNumber: '***1111',
        valueTransunion: '500',
        valueExperian: '900',
        valueEquifax: null,
        severity: 'medium',
        isDisputable: true,
        disputeRecommendation: 'Balance differs across bureaus within this report pull.',
        resolvedAt: null,
      },
      {
        id: 'disc-2',
        clientId: 'client-1',
        creditReportId: 'report-b',
        discrepancyType: 'account_balance',
        field: 'balance',
        creditorName: 'Capital Bank',
        accountNumber: '***1111',
        valueTransunion: '700',
        valueExperian: '800',
        valueEquifax: null,
        severity: 'medium',
        isDisputable: true,
        disputeRecommendation: 'Balance differs across bureaus within this report pull.',
        resolvedAt: null,
      },
    ]);

    const clientOnlyResponse = await GET(new NextRequest('http://localhost/api/admin/disputes/discrepancies?clientId=client-1'));
    const clientOnlyBody = await clientOnlyResponse.json();

    expect(clientOnlyResponse.status).toBe(200);
    expect(clientOnlyBody.discrepancies).toHaveLength(2);
    expect(drizzleOrmMock.eq).toHaveBeenCalledWith(expect.anything(), 'client-1');
    expect(drizzleOrmMock.eq).not.toHaveBeenCalledWith(expect.anything(), 'report-a');

    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@example.com' } });
    adminAuthMock.isSuperAdmin.mockResolvedValue(true);

    mockDiscrepancyQuery([
      {
        id: 'disc-1',
        clientId: 'client-1',
        creditReportId: 'report-a',
        discrepancyType: 'account_balance',
        field: 'balance',
        creditorName: 'Capital Bank',
        accountNumber: '***1111',
        valueTransunion: '500',
        valueExperian: '900',
        valueEquifax: null,
        severity: 'medium',
        isDisputable: true,
        disputeRecommendation: 'Balance differs across bureaus within this report pull.',
        resolvedAt: null,
      },
    ]);

    const reportFilteredResponse = await GET(new NextRequest('http://localhost/api/admin/disputes/discrepancies?clientId=client-1&reportId=report-a'));
    const reportFilteredBody = await reportFilteredResponse.json();

    expect(reportFilteredResponse.status).toBe(200);
    expect(reportFilteredBody.discrepancies).toHaveLength(1);
    expect(drizzleOrmMock.eq).toHaveBeenCalledWith(expect.anything(), 'report-a');
    expect(reportFilteredBody.discrepancies[0]).toMatchObject({ creditReportId: 'report-a' });
  }, 30000);
});

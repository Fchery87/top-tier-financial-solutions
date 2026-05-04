import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

const adminSessionMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/admin-session', () => ({
  getAdminSessionUser: adminSessionMock,
}));

describe('GET /api/admin/credit-report-pulls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminSessionMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
  });

  it('returns credit report pulls for an engagement chronologically', async () => {
    const { GET } = await import('@/app/api/admin/credit-report-pulls/route');
    const rows = [
      {
        id: 'report-1',
        clientId: 'client-1',
        serviceEngagementId: 'engagement-1',
        bureau: 'combined',
        reportDate: new Date('2026-01-01T00:00:00.000Z'),
        uploadedAt: new Date('2026-01-02T00:00:00.000Z'),
        parseStatus: 'completed',
        parserConfidence: 94,
        parserReviewStatus: 'approved',
      },
      {
        id: 'report-2',
        clientId: 'client-1',
        serviceEngagementId: 'engagement-1',
        bureau: 'combined',
        reportDate: new Date('2026-03-01T00:00:00.000Z'),
        uploadedAt: new Date('2026-03-02T00:00:00.000Z'),
        parseStatus: 'pending',
        parserConfidence: 61,
        parserReviewStatus: 'needs_review',
      },
    ];

    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue(rows) }) }) });

    const response = await GET(new NextRequest('http://localhost/api/admin/credit-report-pulls?service_engagement_id=engagement-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual([
      {
        id: 'report-1',
        client_id: 'client-1',
        service_engagement_id: 'engagement-1',
        bureau: 'combined',
        report_date: '2026-01-01T00:00:00.000Z',
        pulled_at: '2026-01-02T00:00:00.000Z',
        parse_status: 'completed',
        parser_confidence: 94,
        parser_review_status: 'approved',
      },
      {
        id: 'report-2',
        client_id: 'client-1',
        service_engagement_id: 'engagement-1',
        bureau: 'combined',
        report_date: '2026-03-01T00:00:00.000Z',
        pulled_at: '2026-03-02T00:00:00.000Z',
        parse_status: 'pending',
        parser_confidence: 61,
        parser_review_status: 'needs_review',
      },
    ]);
  }, 30000);
});

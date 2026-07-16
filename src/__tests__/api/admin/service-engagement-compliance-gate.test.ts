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

describe('GET /api/admin/service-engagements/[id]/compliance-gate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminSessionMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
  });

  it('returns every required compliance gate check with pass/fail status', async () => {
    const { GET } = await import('@/app/api/admin/service-engagements/[id]/compliance-gate/route');

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'engagement-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
        { checkKey: 'client_identity_linked', passed: true, checkedAt: new Date('2026-01-01T00:00:00.000Z'), notes: null },
        { checkKey: 'service_agreement_signed', passed: false, checkedAt: null, notes: 'Agreement not signed yet' },
      ]) }) });

    const response = await GET(
      new NextRequest('http://localhost/api/admin/service-engagements/engagement-1/compliance-gate'),
      { params: Promise.resolve({ id: 'engagement-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.engagement_id).toBe('engagement-1');
    expect(body.is_ready_for_first_work).toBe(false);
    expect(body.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'client_identity_linked',
        label: 'Client identity linked',
        passed: true,
      }),
      expect.objectContaining({
        key: 'service_agreement_signed',
        label: 'Service agreement signed',
        passed: false,
        notes: 'Agreement not signed yet',
      }),
      expect.objectContaining({
        key: 'notice_of_cancellation_delivered',
        passed: false,
      }),
    ]));
  });
});

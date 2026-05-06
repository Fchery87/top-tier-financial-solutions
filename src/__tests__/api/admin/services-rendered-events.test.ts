import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { COMPLIANCE_GATE_CHECKS } from '@/lib/compliance-gate';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

const adminSessionMock = vi.hoisted(() => vi.fn());

const passingGateRecords = COMPLIANCE_GATE_CHECKS.map((check) => ({
  checkKey: check.key,
  passed: true,
  checkedAt: new Date('2026-01-01T00:00:00.000Z'),
  notes: null,
}));

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/admin-session', () => ({
  getAdminSessionUser: adminSessionMock,
}));

describe('POST /api/admin/services-rendered-events', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminSessionMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
  });

  it('records First Dispute Package Submitted from a submitted dispute package', async () => {
    const { POST } = await import('@/app/api/admin/services-rendered-events/route');
    const created = [{
      id: 'event-1',
      clientId: 'client-1',
      serviceEngagementId: 'engagement-1',
      eventType: 'first_dispute_package_submitted',
      sourceDisputeId: 'dispute-1',
      occurredAt: new Date('2026-01-01T00:00:00.000Z'),
      recordedById: 'admin-1',
      notes: 'Certified mail package accepted',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }];

    dbMock.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'dispute-1',
              clientId: 'client-1',
              status: 'sent',
              sentAt: new Date('2026-01-01T00:00:00.000Z'),
              submissionMethod: 'certified_mail',
            }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(passingGateRecords),
        }),
      });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(created) }) });

    const response = await POST(new NextRequest('http://localhost/api/admin/services-rendered-events', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'client-1',
        service_engagement_id: 'engagement-1',
        event_type: 'first_dispute_package_submitted',
        source_dispute_id: 'dispute-1',
        notes: 'Certified mail package accepted',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      id: 'event-1',
      client_id: 'client-1',
      service_engagement_id: 'engagement-1',
      event_type: 'first_dispute_package_submitted',
      source_dispute_id: 'dispute-1',
      recorded_by_id: 'admin-1',
      notes: 'Certified mail package accepted',
    });
  }, 30000);

  it('blocks Services Rendered recording when the Compliance Gate has blockers', async () => {
    const { POST } = await import('@/app/api/admin/services-rendered-events/route');

    dbMock.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'dispute-1',
              clientId: 'client-1',
              status: 'sent',
              sentAt: new Date('2026-01-01T00:00:00.000Z'),
              submissionMethod: 'certified_mail',
            }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { checkKey: 'client_identity_linked', passed: true, checkedAt: new Date('2026-01-01T00:00:00.000Z'), notes: null },
          ]),
        }),
      });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) });

    const response = await POST(new NextRequest('http://localhost/api/admin/services-rendered-events', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'client-1',
        service_engagement_id: 'engagement-1',
        event_type: 'first_dispute_package_submitted',
        source_dispute_id: 'dispute-1',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      code: 'COMPLIANCE_GATE_BLOCKED',
      error: 'Compliance Gate must pass before recording Services Rendered',
    });
    expect(body.blocking_checks).toContain('service_agreement_signed');
    expect(dbMock.insert).not.toHaveBeenCalled();
  }, 30000);

  it('blocks Services Rendered recording when the source dispute belongs to a different Service Engagement', async () => {
    const { POST } = await import('@/app/api/admin/services-rendered-events/route');

    dbMock.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'dispute-1',
            clientId: 'client-1',
            serviceEngagementId: 'engagement-2',
            status: 'sent',
            sentAt: new Date('2026-01-01T00:00:00.000Z'),
            submissionMethod: 'certified_mail',
          }]),
        }),
      }),
    });

    const response = await POST(new NextRequest('http://localhost/api/admin/services-rendered-events', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'client-1',
        service_engagement_id: 'engagement-1',
        event_type: 'first_dispute_package_submitted',
        source_dispute_id: 'dispute-1',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Source dispute does not belong to the Service Engagement' });
    expect(dbMock.insert).not.toHaveBeenCalled();
  }, 30000);
});

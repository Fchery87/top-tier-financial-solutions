import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { READY_GATE_FACTS, gateRecordsFor } from '@/__tests__/fixtures/compliance-gate';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

const requireCapabilityMock = vi.hoisted(() => vi.fn());
const syncMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/compliance-gate-sync', () => ({
  syncComplianceGate: syncMock,
}));

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/admin-session', () => ({
  requireCapability: requireCapabilityMock,
}));

describe('POST /api/workspace/services-rendered-events', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'staff-1', email: 'staff@example.com', role: 'staff' });
  });

  it('records First Dispute Package Submitted from a submitted dispute package', async () => {
    const { POST } = await import('@/app/api/workspace/services-rendered-events/route');
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
      });
    syncMock.mockResolvedValue(gateRecordsFor());
    dbMock.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(created) }) });

    const response = await POST(new NextRequest('http://localhost/api/workspace/services-rendered-events', {
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
    expect(requireCapabilityMock).toHaveBeenCalledWith('billing:client');
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
    const { POST } = await import('@/app/api/workspace/services-rendered-events/route');

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
      });
    syncMock.mockResolvedValue(gateRecordsFor({ ...READY_GATE_FACTS, signedAgreement: null }));
    dbMock.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) });

    const response = await POST(new NextRequest('http://localhost/api/workspace/services-rendered-events', {
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
    expect(syncMock).toHaveBeenCalledWith('engagement-1');
    expect(body.blocking_checks).toEqual([
      'service_agreement_signed',
      'croa_disclosure_acknowledged',
      'cancellation_deadline_calculated',
      'cancellation_window_complete',
      'fee_terms_disclosed',
    ]);
    expect(dbMock.insert).not.toHaveBeenCalled();
  }, 30000);

  it('blocks Services Rendered recording when the source dispute belongs to a different Service Engagement', async () => {
    const { POST } = await import('@/app/api/workspace/services-rendered-events/route');

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

    const response = await POST(new NextRequest('http://localhost/api/workspace/services-rendered-events', {
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

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}));

const adminSessionMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/admin-session', () => ({
  getAdminSessionUser: adminSessionMock,
}));

function createRequest(body: unknown) {
  return new NextRequest('http://localhost/api/admin/service-engagements', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/admin/service-engagements', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminSessionMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
  });

  it('creates a credit restoration engagement for a client', async () => {
    const { POST } = await import('@/app/api/admin/service-engagements/route');
    const clientLookup = [{ id: 'client-1' }];
    const activeLookup: unknown[] = [];
    const created = [{
      id: 'engagement-1',
      clientId: 'client-1',
      serviceType: 'credit_restoration',
      status: 'active',
      lifecycleStage: 'lead',
      openedAt: new Date('2026-01-01T00:00:00.000Z'),
      closedAt: null,
      closureReason: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }];

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(clientLookup) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(activeLookup) }) }) });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(created) }) });

    const response = await POST(createRequest({ client_id: 'client-1', service_type: 'credit_restoration' }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      id: 'engagement-1',
      client_id: 'client-1',
      service_type: 'credit_restoration',
      status: 'active',
      lifecycle_stage: 'lead',
    });
  }, 30000);

  it('blocks a second active engagement for the same service type', async () => {
    const { POST } = await import('@/app/api/admin/service-engagements/route');

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'existing-1' }]) }) }) });

    const response = await POST(createRequest({ client_id: 'client-1', service_type: 'credit_restoration' }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('Client already has an active engagement for this service type');
  }, 30000);
});

describe('GET /api/admin/service-engagements', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminSessionMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
  });

  it('lists engagements for a client', async () => {
    const { GET } = await import('@/app/api/admin/service-engagements/route');
    const rows = [{
      id: 'engagement-1',
      clientId: 'client-1',
      serviceType: 'credit_audit',
      status: 'active',
      lifecycleStage: 'lead',
      openedAt: new Date('2026-01-01T00:00:00.000Z'),
      closedAt: null,
      closureReason: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }];

    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(rows) }) });

    const response = await GET(new NextRequest('http://localhost/api/admin/service-engagements?client_id=client-1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toEqual([
      expect.objectContaining({
        id: 'engagement-1',
        client_id: 'client-1',
        service_type: 'credit_audit',
        lifecycle_stage: 'lead',
      }),
    ]);
  }, 30000);
});

describe('PATCH /api/admin/service-engagements', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminSessionMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
  });

  it('blocks ready_for_first_work when compliance gate checks are incomplete', async () => {
    const { PATCH } = await import('@/app/api/admin/service-engagements/route');

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'engagement-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
        { checkKey: 'client_identity_linked', passed: true, checkedAt: new Date('2026-01-01T00:00:00.000Z'), notes: null },
      ]) }) });

    const response = await PATCH(createRequest({ id: 'engagement-1', lifecycle_stage: 'ready_for_first_work' }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe('Compliance Gate must pass before Ready for First Work');
    expect(body.blocking_checks).toContain('service_agreement_signed');
  }, 30000);

  it('allows ready_for_first_work when every compliance gate check passes', async () => {
    const { COMPLIANCE_GATE_CHECKS } = await import('@/lib/compliance-gate');
    const { PATCH } = await import('@/app/api/admin/service-engagements/route');
    const updated = [{
      id: 'engagement-1',
      clientId: 'client-1',
      serviceType: 'credit_restoration',
      status: 'active',
      lifecycleStage: 'ready_for_first_work',
      openedAt: new Date('2026-01-01T00:00:00.000Z'),
      closedAt: null,
      closureReason: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    }];

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'engagement-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(
        COMPLIANCE_GATE_CHECKS.map((check) => ({ checkKey: check.key, passed: true, checkedAt: new Date('2026-01-01T00:00:00.000Z'), notes: null })),
      ) }) });
    dbMock.update.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(updated) }) }) });

    const response = await PATCH(createRequest({ id: 'engagement-1', lifecycle_stage: 'ready_for_first_work' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lifecycle_stage).toBe('ready_for_first_work');
  }, 30000);
});

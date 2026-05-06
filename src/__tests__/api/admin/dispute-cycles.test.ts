import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

const adminSessionMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/admin-session', () => ({
  getAdminSessionUser: adminSessionMock,
}));

describe('POST /api/admin/dispute-cycles', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    adminSessionMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
  });

  it('creates a canonical dispute cycle record for an engagement', async () => {
    const { POST } = await import('@/app/api/admin/dispute-cycles/route');
    const created = [{
      id: 'cycle-1',
      clientId: 'client-1',
      serviceEngagementId: 'engagement-1',
      cycleNumber: 1,
      status: 'draft',
      itemSelection: JSON.stringify(['item-1']),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }];

    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'engagement-1', clientId: 'client-1' }]) }) }) });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(created) }) });

    const response = await POST(new NextRequest('http://localhost/api/admin/dispute-cycles', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'client-1',
        service_engagement_id: 'engagement-1',
        cycle_number: 1,
        item_selection: ['item-1'],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      id: 'cycle-1',
      client_id: 'client-1',
      service_engagement_id: 'engagement-1',
      cycle_number: 1,
      status: 'draft',
      item_selection: ['item-1'],
    });
  }, 30000);

  it('blocks creating a Dispute Cycle draft without item selection', async () => {
    const { POST } = await import('@/app/api/admin/dispute-cycles/route');

    const response = await POST(new NextRequest('http://localhost/api/admin/dispute-cycles', {
      method: 'POST',
      body: JSON.stringify({
        client_id: 'client-1',
        service_engagement_id: 'engagement-1',
        cycle_number: 1,
        item_selection: [],
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: 'DISPUTE_CYCLE_ITEM_SELECTION_REQUIRED',
      error: 'Dispute Cycle drafts require at least one selected item',
    });
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  }, 30000);
});

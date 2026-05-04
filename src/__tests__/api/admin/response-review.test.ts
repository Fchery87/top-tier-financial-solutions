import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  api: {
    getSession: vi.fn(),
  },
}));

const isSuperAdminMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/admin-auth', () => ({
  isSuperAdmin: isSuperAdminMock,
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@/lib/email-service', () => ({
  triggerAutomation: vi.fn(),
}));

describe('PUT /api/admin/disputes/[id] response review intake', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@example.com' } });
    isSuperAdminMock.mockResolvedValue(true);
  });

  it('requires response document and classification when recording a received response', async () => {
    const { PUT } = await import('@/app/api/admin/disputes/[id]/route');

    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'dispute-1', clientId: 'client-1', negativeItemId: null, bureau: 'experian', round: 1, responseReceivedAt: null, escalationHistory: null }]) }) }) });

    const response = await PUT(
      new NextRequest('http://localhost/api/admin/disputes/dispute-1', {
        method: 'PUT',
        body: JSON.stringify({
          responseReceivedAt: '2026-02-01T00:00:00.000Z',
          responseNotes: 'Bureau responded by mail.',
        }),
      }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Response Review requires a response document and outcome classification' });
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  }, 30000);

  it('rejects generic success as a response review outcome', async () => {
    const { PUT } = await import('@/app/api/admin/disputes/[id]/route');

    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'dispute-1', clientId: 'client-1', negativeItemId: null, bureau: 'experian', round: 1, responseReceivedAt: null, escalationHistory: null }]) }) }) });

    const response = await PUT(
      new NextRequest('http://localhost/api/admin/disputes/dispute-1', {
        method: 'PUT',
        body: JSON.stringify({
          responseReceivedAt: '2026-02-01T00:00:00.000Z',
          responseDocumentUrl: 'portal-documents/user-1/response.pdf',
          outcome: 'success',
        }),
      }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Outcome must use structured response review vocabulary' });
    expect(dbMock.update).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  }, 30000);

  it('recommends method-of-verification after a verified response review', async () => {
    const { PUT } = await import('@/app/api/admin/disputes/[id]/route');
    const updatedDispute = {
      id: 'dispute-1',
      clientId: 'client-1',
      negativeItemId: null,
      status: 'responded',
      outcome: 'verified',
      responseNotes: 'Verified by bureau.',
      trackingNumber: null,
      responseChannel: 'mail',
      scoreImpact: null,
      analysisConfidence: null,
      autoSelected: false,
      sentAt: new Date('2026-01-02T00:00:00.000Z'),
      responseDeadline: new Date('2026-02-01T00:00:00.000Z'),
      responseReceivedAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    };

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'dispute-1', clientId: 'client-1', negativeItemId: null, bureau: 'experian', round: 1, responseReceivedAt: null, responseChannel: 'mail', escalationHistory: null }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([updatedDispute]) }) }) });
    dbMock.update.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const response = await PUT(
      new NextRequest('http://localhost/api/admin/disputes/dispute-1', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'responded',
          responseReceivedAt: '2026-02-01T00:00:00.000Z',
          responseDocumentUrl: 'portal-documents/user-1/response.pdf',
          responseChannel: 'mail',
          outcome: 'verified',
          responseNotes: 'Verified by bureau.',
        }),
      }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.next_cycle_recommendation).toEqual({
      action: 'method_of_verification',
      reason: 'Verified responses should be reviewed for investigation method before another dispute cycle.',
    });
  }, 30000);
});

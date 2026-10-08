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

const getUserRoleMock = vi.hoisted(() => vi.fn());
const findAwaitingClientConfirmationMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/admin-auth', () => ({
  getUserRole: getUserRoleMock,
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@/lib/email-service', () => ({
  triggerAutomation: vi.fn(),
}));

vi.mock('@/lib/dispute-evidence', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/dispute-evidence')>()),
  findAwaitingClientConfirmation: findAwaitingClientConfirmationMock,
}));

describe('PUT /api/admin/disputes/[id] submission tracking', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@example.com' } });
    getUserRoleMock.mockResolvedValue('super_admin');
    findAwaitingClientConfirmationMock.mockResolvedValue(false);
  });

  it('blocks marking a dispute sent while a high-risk packet awaits client confirmation', async () => {
    const { PUT } = await import('@/app/api/admin/disputes/[id]/route');
    findAwaitingClientConfirmationMock.mockResolvedValue(true);

    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'dispute-1', clientId: 'client-1', negativeItemId: null, sentAt: null, escalationHistory: null }]) }) }) });

    const response = await PUT(
      new NextRequest('http://localhost/api/admin/disputes/dispute-1', {
        method: 'PUT',
        body: JSON.stringify({ status: 'sent' }),
      }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'High-risk evidence packet is awaiting client confirmation' });
    expect(findAwaitingClientConfirmationMock).toHaveBeenCalledWith('dispute-1');
    expect(dbMock.update).not.toHaveBeenCalled();
  }, 30000);

  it('blocks marking a dispute submitted without submission tracking', async () => {
    const { PUT } = await import('@/app/api/admin/disputes/[id]/route');

    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'dispute-1', clientId: 'client-1', negativeItemId: null, sentAt: null, escalationHistory: null }]) }) }) });

    const response = await PUT(
      new NextRequest('http://localhost/api/admin/disputes/dispute-1', {
        method: 'PUT',
        body: JSON.stringify({ status: 'sent' }),
      }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Submission tracking is required before marking a dispute submitted' });
    expect(dbMock.update).not.toHaveBeenCalled();
  }, 30000);

  it('records manual certified mail details when marking a dispute submitted', async () => {
    const { PUT } = await import('@/app/api/admin/disputes/[id]/route');
    const updateValues: Record<string, unknown>[] = [];
    const updatedDispute = {
      id: 'dispute-1',
      clientId: 'client-1',
      negativeItemId: null,
      status: 'sent',
      outcome: null,
      responseNotes: null,
      trackingNumber: '9407 3000 0000 0000 0000 00',
      responseChannel: 'mail',
      scoreImpact: null,
      analysisConfidence: null,
      autoSelected: false,
      sentAt: new Date('2026-01-02T00:00:00.000Z'),
      responseDeadline: new Date('2026-02-01T00:00:00.000Z'),
      responseReceivedAt: null,
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      submissionMethod: 'certified_mail',
      submissionRecipient: 'Experian',
      submissionProofDocumentUrl: 'portal-documents/user-1/certified-proof.pdf',
    };

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'dispute-1', clientId: 'client-1', negativeItemId: null, bureau: 'experian', round: 1, sentAt: null, escalationHistory: null, escalationPath: 'bureau' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([updatedDispute]) }) }) });
    dbMock.update.mockReturnValue({ set: vi.fn((values) => { updateValues.push(values); return { where: vi.fn().mockResolvedValue(undefined) }; }) });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ onConflictDoNothing: vi.fn().mockResolvedValue(undefined), onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) }) });

    const response = await PUT(
      new NextRequest('http://localhost/api/admin/disputes/dispute-1', {
        method: 'PUT',
        body: JSON.stringify({
          status: 'sent',
          sentAt: '2026-01-02T00:00:00.000Z',
          submissionMethod: 'certified_mail',
          submissionRecipient: 'Experian',
          submissionProofDocumentUrl: 'portal-documents/user-1/certified-proof.pdf',
          trackingNumber: '9407 3000 0000 0000 0000 00',
        }),
      }),
      { params: Promise.resolve({ id: 'dispute-1' }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateValues[0]).toMatchObject({
      status: 'sent',
      responseChannel: 'mail',
      submissionMethod: 'certified_mail',
      submissionRecipient: 'Experian',
      submissionProofDocumentUrl: 'portal-documents/user-1/certified-proof.pdf',
      trackingNumber: '9407 3000 0000 0000 0000 00',
    });
    expect(body.dispute).toMatchObject({
      status: 'sent',
      tracking_number: '9407 3000 0000 0000 0000 00',
      submission_method: 'certified_mail',
      submission_recipient: 'Experian',
      submission_proof_document_url: 'portal-documents/user-1/certified-proof.pdf',
    });
  }, 30000);
});

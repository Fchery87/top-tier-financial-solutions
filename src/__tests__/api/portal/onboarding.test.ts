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

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe('GET /api/portal/onboarding', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'client@example.com' } });
  });

  it('returns client-safe onboarding blockers from the active engagement compliance gate', async () => {
    const { GET } = await import('@/app/api/portal/onboarding/route');

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'engagement-1', lifecycleStage: 'agreement_signed' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
        { checkKey: 'client_identity_linked', passed: true, checkedAt: new Date('2026-01-01T00:00:00.000Z'), notes: 'internal note hidden' },
        { checkKey: 'identity_document_uploaded', passed: false, checkedAt: null, notes: 'internal note hidden' },
      ]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
        { fileType: 'identity_document' },
      ]) }) });

    const response = await GET(new NextRequest('http://localhost/api/portal/onboarding'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      engagement_id: 'engagement-1',
      lifecycle_stage: 'agreement_signed',
      is_ready_for_first_work: false,
    });
    expect(body.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'identity_document_uploaded',
        label: 'Identity document uploaded',
      }),
    ]));
    expect(body.document_checklist).toEqual(expect.arrayContaining([
      { key: 'identity_document', label: 'Identity document', completed: true },
      { key: 'proof_of_address', label: 'Proof of address', completed: false },
    ]));
    expect(JSON.stringify(body)).not.toContain('internal note hidden');
  }, 30000);
});

describe('POST /api/portal/documents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'client@example.com' } });
  });

  it('rejects arbitrary file URLs from portal document registration', async () => {
    const { POST } = await import('@/app/api/portal/documents/route');

    const response = await POST(new NextRequest('http://localhost/api/portal/documents', {
      method: 'POST',
      body: JSON.stringify({
        case_id: 'case-1',
        file_name: 'id.pdf',
        file_type: 'identity_document',
        file_url: 'https://evil.example/id.pdf',
        file_size: 100,
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Use a controlled portal upload key, not an arbitrary file URL');
  }, 30000);

  it('accepts a controlled storage key owned by the authenticated portal user', async () => {
    const { POST } = await import('@/app/api/portal/documents/route');

    dbMock.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ userId: 'user-1' }]) }) }) });
    const insert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    (dbMock as typeof dbMock & { insert: ReturnType<typeof vi.fn> }).insert = insert;

    const response = await POST(new NextRequest('http://localhost/api/portal/documents', {
      method: 'POST',
      body: JSON.stringify({
        case_id: 'case-1',
        file_name: 'id.pdf',
        file_type: 'identity_document',
        storage_key: 'portal-documents/user-1/id.pdf',
        file_size: 100,
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.file_url).toBe('portal-documents/user-1/id.pdf');
  }, 30000);
});

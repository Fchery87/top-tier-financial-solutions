// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  insert: vi.fn(),
  select: vi.fn(),
}));
const getSessionMock = vi.hoisted(() => vi.fn());
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const uploadToR2Mock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: getSessionMock } } }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));
vi.mock('@/lib/r2-storage', () => ({ uploadToR2: uploadToR2Mock }));
vi.mock('@/lib/rate-limit', () => ({ uploadLimiter: {} }));
vi.mock('@/lib/rate-limit-middleware', () => ({
  rateLimited: () => <THandler>(handler: THandler) => handler,
}));

type MultipartPart = {
  name: string;
  value: string;
  filename?: string;
  contentType?: string;
};

function multipartRequest(url: string, parts: MultipartPart[]) {
  const boundary = 'validation-boundary';
  const lines: string[] = [];

  for (const part of parts) {
    lines.push(`--${boundary}`);
    lines.push(
      part.filename === undefined
        ? `Content-Disposition: form-data; name="${part.name}"`
        : `Content-Disposition: form-data; name="${part.name}"; filename="${part.filename}"`,
    );
    if (part.contentType !== undefined) {
      lines.push(`Content-Type: ${part.contentType}`);
    }
    lines.push('', part.value);
  }
  lines.push(`--${boundary}--`, '');

  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    body: lines.join('\r\n'),
  });
}

const pdfFile = {
  value: 'evidence',
  filename: 'evidence.pdf',
  contentType: 'application/pdf',
} satisfies Omit<MultipartPart, 'name'>;

describe('controlled document write validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSessionMock.mockResolvedValue({ user: { id: 'user-1', email: 'client@example.com' } });
    requireCapabilityMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
  });

  it('rejects an oversized portal registration before looking up or inserting a case', async () => {
    const { POST } = await import('@/app/api/portal/documents/route');

    const response = await POST(new NextRequest('http://localhost/api/portal/documents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        case_id: 'case-1',
        file_name: 'identity.pdf',
        file_type: 'identity_document',
        storage_key: 'portal-documents/user-1/identity.pdf',
        file_size: 10 * 1024 * 1024 + 1,
      }),
    }));

    expect(response.status).toBe(400);
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('rejects an invalid portal document type before database or storage work', async () => {
    const { POST } = await import('@/app/api/portal/documents/upload/route');

    const response = await POST(multipartRequest('http://localhost/api/portal/documents/upload', [
      { name: 'file', ...pdfFile },
      { name: 'file_type', value: 'unsupported' },
    ]));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid document type' });
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it('rejects more than twenty staff evidence files before client lookup or storage work', async () => {
    const { POST } = await import('@/app/api/workspace/disputes/evidence/upload/route');
    const files = Array.from({ length: 21 }, (_, index) => ({
      name: 'files',
      value: `evidence-${index}`,
      filename: `evidence-${index}.pdf`,
      contentType: 'application/pdf',
    }));

    const response = await POST(multipartRequest('http://localhost/api/workspace/disputes/evidence/upload', [
      { name: 'client_id', value: 'client-1' },
      { name: 'file_type', value: 'correspondence' },
      ...files,
    ]));

    expect(response.status).toBe(400);
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });

  it('rejects non-text admin document notes before lookup or storage work', async () => {
    const { POST } = await import('@/app/api/workspace/clients/documents/route');

    const response = await POST(multipartRequest('http://localhost/api/workspace/clients/documents', [
      { name: 'file', ...pdfFile },
      { name: 'client_id', value: 'client-1' },
      { name: 'document_type', value: 'government_id' },
      { name: 'notes', ...pdfFile },
    ]));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Notes must be text' });
    expect(dbMock.select).not.toHaveBeenCalled();
    expect(uploadToR2Mock).not.toHaveBeenCalled();
  });
});

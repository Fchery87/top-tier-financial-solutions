// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const uploadToR2Mock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/r2-storage', () => ({ uploadToR2: uploadToR2Mock }));

describe('POST /api/admin/disputes/evidence/upload', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'admin-1' });
    uploadToR2Mock.mockResolvedValue({
      key: 'client-documents/user-1/evidence/response.pdf',
      size: 42,
    });
  });

  it('stores staff-uploaded evidence as a controlled client document', async () => {
    const { POST } = await import('@/app/api/admin/disputes/evidence/upload/route');
    dbMock.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1', userId: 'user-1' }]) }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'case-1' }]) }),
        }),
      });
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });

    const boundary = 'evidence-upload-test-boundary';
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="client_id"',
      '',
      'client-1',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file_type"',
      '',
      'correspondence',
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="response.pdf"',
      'Content-Type: application/pdf',
      '',
      'response',
      `--${boundary}--`,
      '',
    ].join('\r\n');

    const request = new NextRequest('http://localhost/api/admin/disputes/evidence/upload', {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
    });
    const response = await POST(request);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      client_id: 'client-1',
      file_url: 'client-documents/user-1/evidence/response.pdf',
      uploaded_by: 'admin',
    });
    expect(requireCapabilityMock).toHaveBeenCalledWith('disputes:write');
    expect(uploadToR2Mock).toHaveBeenCalledWith(
      expect.any(Buffer),
      'response.pdf',
      'application/pdf',
      'client-documents/user-1/evidence',
    );
  });
});

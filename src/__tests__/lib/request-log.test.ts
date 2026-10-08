import { describe, expect, it, vi } from 'vitest';

import { logRequest } from '@/lib/request-log';

describe('logRequest', () => {
  it('writes one JSON line with the request fields and no body', () => {
    const write = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    logRequest({
      requestId: 'req-1',
      method: 'GET',
      path: '/api/admin/clients/client-1',
      status: 200,
      durationMs: 12,
      actorId: 'staff-1',
    });

    expect(write).toHaveBeenCalledOnce();
    expect(JSON.parse(String(write.mock.calls[0][0]))).toEqual({
      requestId: 'req-1',
      method: 'GET',
      path: '/api/admin/clients/client-1',
      status: 200,
      durationMs: 12,
      actorId: 'staff-1',
    });

    write.mockRestore();
  });
});

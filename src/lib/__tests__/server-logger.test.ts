import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  logServerEvent,
  setServerLogSinkForTests,
  type ServerLogEvent,
} from '@/lib/server-logger';

describe('logServerEvent', () => {
  afterEach(() => {
    setServerLogSinkForTests(undefined);
  });

  it('emits structured operational metadata while recursively redacting sensitive fields', () => {
    const sink = vi.fn<(event: ServerLogEvent) => void>();
    setServerLogSinkForTests(sink);

    logServerEvent({
      level: 'error',
      event: 'client.read.failed',
      requestId: 'request-1',
      route: '/api/workspace/clients/client-1',
      method: 'GET',
      status: 500,
      actorUserId: 'admin-1',
      resourceType: 'client_record',
      resourceId: 'client-1',
      metadata: {
        retryable: true,
        email: 'client@example.com',
        nested: {
          promptContext: 'private prompt',
          displayName: 'Allowed operational label',
          tokens: ['one', 'two'],
        },
      },
    });

    expect(sink).toHaveBeenCalledWith({
      level: 'error',
      event: 'client.read.failed',
      requestId: 'request-1',
      route: '/api/workspace/clients/client-1',
      method: 'GET',
      status: 500,
      actorUserId: 'admin-1',
      resourceType: 'client_record',
      resourceId: 'client-1',
      metadata: {
        retryable: true,
        nested: {
          displayName: 'Allowed operational label',
        },
      },
    });
  });

  it('normalizes errors without serializing attached or message data', () => {
    const sink = vi.fn<(event: ServerLogEvent) => void>();
    setServerLogSinkForTests(sink);
    const error = Object.assign(new Error('Database unavailable'), {
      email: 'client@example.com',
      content: 'private letter content',
    });

    logServerEvent({
      level: 'error',
      event: 'database.query.failed',
      error,
    });

    expect(sink).toHaveBeenCalledWith(expect.objectContaining({
      level: 'error',
      event: 'database.query.failed',
      error: {
        name: 'Error',
      },
    }));
    expect(JSON.stringify(sink.mock.calls)).not.toContain('Database unavailable');
    expect(JSON.stringify(sink.mock.calls)).not.toContain('client@example.com');
    expect(JSON.stringify(sink.mock.calls)).not.toContain('private letter content');
  });
});

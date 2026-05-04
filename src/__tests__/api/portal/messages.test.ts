import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
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
  headers: vi.fn().mockResolvedValue(new Headers({ 'x-forwarded-for': '127.0.0.1' })),
}));

describe('POST /api/portal/messages', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'client@example.com' } });
  });

  it('creates a secure portal message thread for the authenticated client', async () => {
    const { POST } = await import('@/app/api/portal/messages/route');
    const threadValues = vi.fn().mockResolvedValue(undefined);
    const messageValues = vi.fn().mockResolvedValue(undefined);

    dbMock.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'client-1', userId: 'user-1' }]),
        }),
      }),
    });
    dbMock.insert
      .mockReturnValueOnce({ values: threadValues })
      .mockReturnValueOnce({ values: messageValues });

    const response = await POST(new NextRequest('http://localhost/api/portal/messages', {
      method: 'POST',
      body: JSON.stringify({
        subject: 'Question about next dispute round',
        content: 'Can you confirm what happens next?',
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.thread_id).toEqual(expect.any(String));
    expect(body.message_id).toEqual(expect.any(String));
    expect(threadValues).toHaveBeenCalledWith(expect.objectContaining({
      clientId: 'client-1',
      subject: 'Question about next dispute round',
      unreadByAdmin: 1,
      unreadByClient: 0,
    }));
    expect(messageValues).toHaveBeenCalledWith(expect.objectContaining({
      threadId: body.thread_id,
      senderId: 'user-1',
      senderType: 'client',
      content: 'Can you confirm what happens next?',
      senderIpAddress: '127.0.0.1',
    }));
  }, 30000);
});

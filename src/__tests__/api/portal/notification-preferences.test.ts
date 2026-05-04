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
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe('PUT /api/portal/notification-preferences', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'client@example.com' } });
  });

  it('lets an authenticated client disable email notifications for portal messaging', async () => {
    const { PUT } = await import('@/app/api/portal/notification-preferences/route');
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn().mockReturnValue({ where: updateWhere });

    dbMock.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'client-1', userId: 'user-1' }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'prefs-1' }]),
          }),
        }),
      });
    dbMock.update.mockReturnValue({ set: updateSet });

    const response = await PUT(new NextRequest('http://localhost/api/portal/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify({
        email_enabled: false,
        messaging_emails: false,
        progress_reports: true,
      }),
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.preferences).toMatchObject({
      client_id: 'client-1',
      email_enabled: false,
      messaging_emails: false,
      progress_reports: true,
    });
    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      emailEnabled: false,
      messagingEmails: false,
      progressReports: true,
    }));
  }, 30000);
});

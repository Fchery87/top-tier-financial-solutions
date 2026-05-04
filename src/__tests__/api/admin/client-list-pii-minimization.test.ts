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

const adminAuthMock = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(),
}));

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/admin-auth', () => adminAuthMock);

vi.mock('@/lib/rate-limit-middleware', () => ({
  rateLimited: () => (handler: unknown) => handler,
}));

vi.mock('@/lib/rate-limit', () => ({
  sensitiveLimiter: {},
}));

vi.mock('@/lib/db-encryption', () => ({
  decryptClientData: vi.fn((data) => data),
  encryptClientData: vi.fn((data) => data),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe('GET /api/admin/clients PII minimization', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@example.com' } });
    adminAuthMock.isSuperAdmin.mockResolvedValue(true);
  });

  it('does not include DOB or SSN last four in the default client list response', async () => {
    dbMock.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([{ id: 'client-1', userId: null, leadId: null, firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '555-0101', streetAddress: '1 Main St', city: 'Miami', state: 'FL', zipCode: '33101', dateOfBirth: new Date('1990-01-01'), ssnLast4: '1234', status: 'active', notes: null, convertedAt: null, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-02'), userName: null }]),
                }),
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 1 }]) }) });

    const { GET } = await import('@/app/api/admin/clients/route');
    const response = await GET(new NextRequest('http://localhost/api/admin/clients'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0]).not.toHaveProperty('date_of_birth');
    expect(body.items[0]).not.toHaveProperty('ssn_last_4');
    expect(JSON.stringify(body)).not.toContain('1234');
    expect(JSON.stringify(body)).not.toContain('1990-01-01');
  }, 30000);
});

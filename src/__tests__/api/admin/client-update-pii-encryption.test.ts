import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  update: vi.fn(),
}));

const authMock = vi.hoisted(() => ({
  api: {
    getSession: vi.fn(),
  },
}));

const adminAuthMock = vi.hoisted(() => ({
  isSuperAdmin: vi.fn(),
}));

const encryptionMock = vi.hoisted(() => ({
  encryptClientData: vi.fn((data: Record<string, unknown>) => {
    const encrypted: Record<string, string> = {};
    for (const key of Object.keys(data)) encrypted[key] = `encrypted:${String(data[key])}`;
    return encrypted;
  }),
  decryptClientData: vi.fn((data) => data),
  decryptCreditAccountData: vi.fn((data) => data),
  decryptNegativeItemData: vi.fn((data) => data),
  decryptDisputeData: vi.fn((data) => data),
}));

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('@/lib/admin-auth', () => adminAuthMock);

vi.mock('@/lib/db-encryption', () => encryptionMock);

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe('PUT /api/admin/clients/[id] PII encryption boundary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@example.com' } });
    adminAuthMock.isSuperAdmin.mockResolvedValue(true);
    dbMock.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  it('encrypts all client PII fields accepted by client creation when updating a client', async () => {
    const { PUT } = await import('@/app/api/admin/clients/[id]/route');

    const response = await PUT(
      new NextRequest('http://localhost/api/admin/clients/client-1', {
        method: 'PUT',
        body: JSON.stringify({
          first_name: 'Jane',
          last_name: 'Doe',
          phone: '555-0101',
          street_address: '1 Main St',
          city: 'Miami',
          state: 'FL',
          zip_code: '33101',
          date_of_birth: '1990-01-01',
          ssn_last_4: '1234',
        }),
      }),
      { params: Promise.resolve({ id: 'client-1' }) },
    );

    expect(response.status).toBe(200);
    expect(encryptionMock.encryptClientData).toHaveBeenCalledWith({
      firstName: 'Jane',
      lastName: 'Doe',
      phone: '555-0101',
      streetAddress: '1 Main St',
      city: 'Miami',
      state: 'FL',
      zipCode: '33101',
      dateOfBirth: '1990-01-01',
      ssnLast4: '1234',
    });
  }, 30000);
});

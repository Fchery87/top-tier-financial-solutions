import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));

const headersMock = vi.hoisted(() => vi.fn());
const getSessionMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: getSessionMock } },
}));

vi.mock('next/headers', () => ({
  headers: headersMock,
}));

function clientSelect(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

describe('POST /api/portal/payment-authorization', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    headersMock.mockResolvedValue(new Headers({ 'x-forwarded-for': '127.0.0.1' }));
  });

  it('returns 401 when nobody is signed in', async () => {
    const { POST } = await import('@/app/api/portal/payment-authorization/route');
    getSessionMock.mockResolvedValue(null);

    const response = await POST(new NextRequest('http://localhost/api/portal/payment-authorization', {
      method: 'POST',
      body: JSON.stringify({ bank_name: 'First Bank' }),
    }));
    if (!response) throw new Error('expected a response');

    expect(response.status).toBe(401);
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('saves an authorization for the signed-in client and omits the account numbers', async () => {
    const { POST } = await import('@/app/api/portal/payment-authorization/route');
    getSessionMock.mockResolvedValue({ user: { id: 'user-1', email: 'client@example.com' } });
    dbMock.select.mockReturnValueOnce(clientSelect([{ id: 'client-1', userId: 'user-1' }]));
    dbMock.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                for: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
        update: vi.fn(),
      };
      return callback(tx);
    });

    const response = await POST(new NextRequest('http://localhost/api/portal/payment-authorization', {
      method: 'POST',
      body: JSON.stringify({
        bank_name: 'First Bank',
        routing_number: '021000021',
        account_number: '123456789',
        account_type: 'checking',
        maximum_amount_cents: 25000,
        signature_data: 'Jane Client',
      }),
    }));
    if (!response) throw new Error('expected a response');
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.bank_name).toBe('First Bank');
    expect(body.account_last4).toBe('6789');
    expect(body.maximum_amount_cents).toBe(25000);
    expect(serialized).not.toContain('021000021');
    expect(serialized).not.toContain('123456789');
    expect(serialized).not.toContain('routing_number');
    expect(serialized).not.toContain('account_number');
    expect(dbMock.transaction).toHaveBeenCalledTimes(1);
  });
});

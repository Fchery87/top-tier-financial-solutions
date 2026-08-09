import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const selectResults = vi.hoisted(() => [] as unknown[][]);
const dbMock = vi.hoisted(() => ({ select: vi.fn() }));
const requireCapabilityMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/rate-limit-middleware', () => ({
  rateLimited: () => (handler: unknown) => handler,
}));
vi.mock('@/lib/rate-limit', () => ({ sensitiveLimiter: {} }));
vi.mock('@/lib/db-encryption', () => ({
  decryptClientData: vi.fn((data) => data),
  decryptDisputeData: vi.fn((data) => data),
}));

function selectBuilder(result: unknown[]) {
  const builder = {
    from: vi.fn(() => builder),
    leftJoin: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
  };
  return builder;
}

describe('GET /api/admin/search', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    selectResults.length = 0;
    requireCapabilityMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    dbMock.select.mockImplementation(() => selectBuilder(selectResults.shift() || []));
  });

  it('rejects users without either record-read capability', async () => {
    requireCapabilityMock.mockResolvedValue(null);

    const { GET } = await import('@/app/api/workspace/search/route');
    const response = await GET(new NextRequest('http://localhost/api/admin/search?q=jane'));

    expect(response.status).toBe(403);
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('returns an empty result set for queries shorter than two characters', async () => {
    const { GET } = await import('@/app/api/workspace/search/route');
    const response = await GET(new NextRequest('http://localhost/api/admin/search?q=j'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ query: '', results: [] });
    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it('searches authorized records and excludes sensitive source fields from JSON', async () => {
    selectResults.push(
      [{
        id: 'client-jane',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        status: 'active',
        phone: '555-0101',
        ssnLast4: '1234',
      }],
      [{
        id: 'dispute-1',
        clientFirstName: 'Jane',
        clientLastName: 'Doe',
        creditorName: 'Capital One',
        disputeReason: 'Incorrect balance',
        bureau: 'experian',
        status: 'sent',
        round: 2,
        accountNumber: '9999',
        letterContent: 'private letter',
      }],
    );

    const { GET } = await import('@/app/api/workspace/search/route');
    const response = await GET(new NextRequest('http://localhost/api/admin/search?q=jane%20doe'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      query: 'jane doe',
      results: [
        {
          kind: 'client',
          id: 'client-jane',
          label: 'Jane Doe',
          description: 'jane@example.com · Active',
          href: '/workspace/clients/client-jane',
        },
        {
          kind: 'dispute',
          id: 'dispute-1',
          label: 'Jane Doe — Capital One',
          description: 'Experian · Round 2 · Sent',
          href: '/workspace/disputes?dispute=dispute-1',
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain('555-0101');
    expect(JSON.stringify(body)).not.toContain('1234');
    expect(JSON.stringify(body)).not.toContain('9999');
    expect(JSON.stringify(body)).not.toContain('private letter');
  });
});

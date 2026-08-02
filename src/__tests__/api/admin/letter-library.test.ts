import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const selectResults = vi.hoisted(() => [] as unknown[][]);
const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  transaction: vi.fn(),
}));
const txMock = vi.hoisted(() => ({
  insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
}));
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const recordAdminActivityMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/admin-activity', () => ({ recordAdminActivity: recordAdminActivityMock }));

function libraryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'library-1',
    name: 'Verification strategy',
    description: 'Description',
    methodology: 'factual',
    targetRecipient: 'bureau',
    round: 1,
    itemTypes: JSON.stringify(['collection']),
    bureau: null,
    reasonCodes: JSON.stringify(['verification_required']),
    content: 'Prompt content',
    promptContext: 'Prompt context',
    variables: JSON.stringify(['creditorName']),
    legalCitations: JSON.stringify(['FCRA 611']),
    timesUsed: 2,
    successCount: 1,
    effectivenessRating: null,
    lastUsedAt: null,
    isActive: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function selectBuilder(result: unknown[]) {
  const builder = {
    where: vi.fn(() => builder),
    limit: vi.fn(() => Promise.resolve(result)),
    orderBy: vi.fn(() => Promise.resolve(result)),
  };
  return { from: vi.fn(() => builder) };
}

describe('letter library API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    selectResults.length = 0;
    requireCapabilityMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' });
    dbMock.select.mockImplementation(() => selectBuilder(selectResults.shift() || []));
    dbMock.transaction.mockImplementation(async (callback: (tx: typeof txMock) => Promise<unknown>) => callback(txMock));
  });

  it('rejects malformed JSON arrays before any write', async () => {
    const { parsePayload } = await import('@/app/api/admin/letter-library/route');

    expect(parsePayload({
      name: 'Broken', methodology: 'factual', content: 'Prompt', item_types: '[broken',
    })).toBeNull();
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('creates a row with array fields intact and capability enforcement', async () => {
    const { POST } = await import('@/app/api/admin/letter-library/route');
    const response = await POST(new NextRequest('http://localhost/api/admin/letter-library', {
      method: 'POST',
      body: JSON.stringify({
        name: 'New strategy', methodology: 'factual', content: 'Prompt',
        item_types: ['collection'], reason_codes: ['verification_required'],
        variables: ['creditorName'], legal_citations: ['FCRA 611'],
      }),
    }));

    expect(response.status).toBe(201);
    const values = txMock.insert.mock.results[0]?.value.values.mock.calls[0]?.[0];
    expect(values.itemTypes).toBe('["collection"]');
    expect(values.legalCitations).toBe('["FCRA 611"]');
    expect(recordAdminActivityMock).toHaveBeenCalledWith(txMock, expect.objectContaining({ action: 'letter_library.created' }));

    requireCapabilityMock.mockResolvedValueOnce(null);
    const forbidden = await POST(new NextRequest('http://localhost/api/admin/letter-library', { method: 'POST', body: '{}' }));
    expect(forbidden.status).toBe(403);
  });

  it('preserves arrays when reactivation sends only the active-state change', async () => {
    const { PATCH } = await import('@/app/api/admin/letter-library/[id]/route');
    selectResults.push([libraryRow({ isActive: false })], [libraryRow({ isActive: true })]);

    const response = await PATCH(new NextRequest('http://localhost/api/admin/letter-library/library-1', {
      method: 'PATCH',
      body: JSON.stringify({ is_active: true }),
    }), { params: Promise.resolve({ id: 'library-1' }) });

    expect(response.status).toBe(200);
    const values = txMock.update.mock.results[0]?.value.set.mock.calls[0]?.[0];
    expect(values.itemTypes).toBe('["collection"]');
    expect(values.reasonCodes).toBe('["verification_required"]');
    expect(values.variables).toBe('["creditorName"]');
    expect(values.legalCitations).toBe('["FCRA 611"]');
    expect(values.isActive).toBe(true);
  });

  it('deactivates without deleting historical strategy data', async () => {
    const { DELETE } = await import('@/app/api/admin/letter-library/[id]/route');
    selectResults.push([libraryRow()]);

    const response = await DELETE(new NextRequest('http://localhost/api/admin/letter-library/library-1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'library-1' }),
    });

    expect(response.status).toBe(200);
    expect(txMock.update.mock.results[0]?.value.set.mock.calls[0]?.[0].isActive).toBe(false);
  });
});

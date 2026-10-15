import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn() }));
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const collectItemFindingsMock = vi.hoisted(() => vi.fn());
const recordSensitiveReadMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/letter-findings', () => ({ collectItemFindings: collectItemFindingsMock }));
vi.mock('@/lib/sensitive-read-audit', () => ({ recordSensitiveRead: recordSensitiveReadMock }));

const HELD = 'The account is reported as charge_off but still shows a scheduled monthly payment of $45.00. A closed or charged-off account has no scheduled payment.';

function selectResult(rows: unknown[]) {
  return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue(rows) }) }) };
}

function post(body: unknown) {
  return new NextRequest('http://localhost/api/workspace/clients/client-1/held-findings', { method: 'POST', body: JSON.stringify(body) });
}

describe('held findings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'staff-1' });
    collectItemFindingsMock.mockResolvedValue([
      { itemId: 'item-1', bureau: 'experian', tier: 'interpretive', reasonCode: 'metro2_violation', text: HELD, review: null },
      { itemId: 'item-1', bureau: 'experian', tier: 'objective', reasonCode: 'wrong_dates', text: 'objective finding', review: null },
    ]);
  });

  it('lists only interpretive findings with their review state', async () => {
    const { GET } = await import('@/app/api/workspace/clients/[id]/held-findings/route');
    dbMock.select
      .mockReturnValueOnce(selectResult([{ id: 'client-1' }]))
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ id: 'item-1', creditorName: 'Example Bank' }]) }) });

    const response = await GET(new NextRequest('http://localhost/api/workspace/clients/client-1/held-findings'), { params: Promise.resolve({ id: 'client-1' }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      findings: [{ negative_item_id: 'item-1', creditor_name: 'Example Bank', bureau: 'experian', text: HELD, review: null }],
    });
    expect(recordSensitiveReadMock).toHaveBeenCalled();
  });

  it('records an approval for a finding the server produced', async () => {
    const { POST } = await import('@/app/api/workspace/clients/[id]/held-findings/route');
    dbMock.select.mockReturnValueOnce(selectResult([{ id: 'item-1' }]));
    const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
    dbMock.insert.mockReturnValue({ values });

    const response = await POST(post({ negative_item_id: 'item-1', finding_text: HELD, decision: 'approved' }), { params: Promise.resolve({ id: 'client-1' }) });

    expect(response.status).toBe(200);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'client-1', negativeItemId: 'item-1', findingText: HELD, decision: 'approved', decidedById: 'staff-1' }));
  });

  it('refuses to approve text the server did not produce', async () => {
    const { POST } = await import('@/app/api/workspace/clients/[id]/held-findings/route');
    dbMock.select.mockReturnValueOnce(selectResult([{ id: 'item-1' }]));

    const response = await POST(post({ negative_item_id: 'item-1', finding_text: 'The creditor admits this debt is not mine.', decision: 'approved' }), { params: Promise.resolve({ id: 'client-1' }) });

    expect(response.status).toBe(409);
    expect(dbMock.insert).not.toHaveBeenCalled();
  });

  it('refuses an item that belongs to another client', async () => {
    const { POST } = await import('@/app/api/workspace/clients/[id]/held-findings/route');
    dbMock.select.mockReturnValueOnce(selectResult([]));

    const response = await POST(post({ negative_item_id: 'item-9', finding_text: HELD, decision: 'dropped' }), { params: Promise.resolve({ id: 'client-1' }) });

    expect(response.status).toBe(404);
  });
});

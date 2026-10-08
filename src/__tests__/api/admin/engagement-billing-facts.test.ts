import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { queryChain } from '@/__tests__/fixtures/compliance-gate';

const dbMock = vi.hoisted(() => ({ select: vi.fn(), transaction: vi.fn() }));
const requireCapabilityMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));

const engagement = {
  id: 'engagement-1',
  clientId: 'client-1',
  salesChannel: null,
  servicePeriodEndsAt: null,
  resultsAchievedAt: null,
  resultsVerificationReportId: null,
  resultsVerificationReportDate: null,
  resultsVerifiedById: null,
  resultsVerifiedAt: null,
};
const context = { params: Promise.resolve({ id: 'engagement-1' }) };

function patch(body: unknown) {
  return new NextRequest('http://localhost/api/workspace/service-engagements/engagement-1/billing-facts', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/workspace/service-engagements/[id]/billing-facts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'staff-1', email: 'staff@example.com', role: 'staff' });
  });

  it('rejects a verification report that belongs to another client', async () => {
    const { PATCH } = await import('@/app/api/workspace/service-engagements/[id]/billing-facts/route');
    const reportLookup = queryChain([]);
    dbMock.select.mockReturnValueOnce(queryChain([engagement])).mockReturnValueOnce(reportLookup);

    const response = await PATCH(patch({ resultsVerificationReportId: 'report-of-someone-else' }), context);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Verification report not found for this client' });
    expect(reportLookup.where).toHaveBeenCalledTimes(1);
    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('takes the report date from the report, records who verified it and logs before/after', async () => {
    const { PATCH } = await import('@/app/api/workspace/service-engagements/[id]/billing-facts/route');
    dbMock.select
      .mockReturnValueOnce(queryChain([engagement]))
      .mockReturnValueOnce(queryChain([{ id: 'report-1', reportDate: new Date('2026-09-15T00:00:00.000Z') }]));
    const update = queryChain(undefined);
    const activity = queryChain(undefined);
    const tx = { update: vi.fn().mockReturnValue(update), insert: vi.fn().mockReturnValue(activity) };
    dbMock.transaction.mockImplementation(async (callback: (executor: typeof tx) => Promise<void>) => callback(tx));

    const response = await PATCH(patch({
      salesChannel: 'telemarketing',
      resultsAchievedAt: '2026-03-15T00:00:00.000Z',
      resultsVerificationReportId: 'report-1',
    }), context);

    expect(response.status).toBe(200);
    expect(update.set).toHaveBeenCalledWith(expect.objectContaining({
      salesChannel: 'telemarketing',
      resultsAchievedAt: new Date('2026-03-15T00:00:00.000Z'),
      resultsVerificationReportId: 'report-1',
      resultsVerificationReportDate: new Date('2026-09-15T00:00:00.000Z'),
      resultsVerifiedById: 'staff-1',
      resultsVerifiedAt: expect.any(Date),
    }));
    const logged = activity.values.mock.calls[0][0] as { action: string; subjectId: string; metadata: string };
    expect(logged.action).toBe('service_engagement.billing_facts_updated');
    expect(logged.subjectId).toBe('engagement-1');
    expect(JSON.parse(logged.metadata).before).toMatchObject({ salesChannel: null, resultsVerificationReportId: null });
    expect(JSON.parse(logged.metadata).after).toMatchObject({ salesChannel: 'telemarketing', resultsVerificationReportDate: '2026-09-15T00:00:00.000Z' });
  });

  it('rejects an unknown sales channel', async () => {
    const { PATCH } = await import('@/app/api/workspace/service-engagements/[id]/billing-facts/route');

    const response = await PATCH(patch({ salesChannel: 'door_to_door' }), context);

    expect(response.status).toBe(400);
    expect(dbMock.select).not.toHaveBeenCalled();
  });
});

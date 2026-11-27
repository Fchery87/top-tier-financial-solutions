// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const dbMock = vi.hoisted(() => ({ delete: vi.fn(), update: vi.fn() }));
vi.mock('@/db/client', () => ({ db: dbMock }));

const dialect = new PgDialect();

function render(where: unknown) {
  return dialect.sqlToQuery(where as Parameters<typeof dialect.sqlToQuery>[0]);
}

describe('cleanUpStalePendingSubscribers', () => {
  const deleteWhere = vi.fn();
  const updateSet = vi.fn();
  const updateWhere = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    deleteWhere.mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]) });
    dbMock.delete.mockReturnValue({ where: deleteWhere });
    updateWhere.mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'c' }]) });
    updateSet.mockReturnValue({ where: updateWhere });
    dbMock.update.mockReturnValue({ set: updateSet });
  });

  it('deletes only never-unsubscribed pending rows older than 30 days', async () => {
    const { cleanUpStalePendingSubscribers, STALE_PENDING_AFTER_MS } = await import('@/lib/newsletter-pending-cleanup');
    const now = new Date('2026-12-01T00:00:00Z');
    await cleanUpStalePendingSubscribers(now);

    const { sql, params } = render(deleteWhere.mock.calls[0][0]);
    expect(sql).toContain('"status" = $');
    expect(sql).toContain('"unsubscribed_at" is null');
    expect(sql).toContain('"updated_at" < $');
    expect(params).toContain('pending');
    const cutoff = params.find((p) => p instanceof Date || (typeof p === 'string' && /^\d{4}-/.test(p)));
    expect(new Date(cutoff as string | Date).getTime()).toBe(now.getTime() - STALE_PENDING_AFTER_MS);
    expect(STALE_PENDING_AFTER_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('never deletes a row that has an opt-out on record: it restores it to unsubscribed', async () => {
    const { cleanUpStalePendingSubscribers } = await import('@/lib/newsletter-pending-cleanup');
    await cleanUpStalePendingSubscribers(new Date('2026-12-01T00:00:00Z'));

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'unsubscribed' }));
    const { sql, params } = render(updateWhere.mock.calls[0][0]);
    expect(sql).toContain('"unsubscribed_at" is not null');
    expect(sql).toContain('"updated_at" < $');
    expect(params).toContain('pending');
  });

  it('reports how many rows each step touched', async () => {
    const { cleanUpStalePendingSubscribers } = await import('@/lib/newsletter-pending-cleanup');
    await expect(cleanUpStalePendingSubscribers()).resolves.toEqual({ deleted: 2, restoredToUnsubscribed: 1 });
  });
});

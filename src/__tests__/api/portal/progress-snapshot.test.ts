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

vi.mock('@/db/client', () => ({
  db: dbMock,
}));

vi.mock('@/lib/auth', () => ({
  auth: authMock,
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe('GET /api/portal/progress-snapshot', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.api.getSession.mockResolvedValue({ user: { id: 'user-1', email: 'client@example.com' } });
  });

  it('returns a client-facing progress snapshot from workflow, tasks, documents, cycles, outcomes, and pulls', async () => {
    const { GET } = await import('@/app/api/portal/progress-snapshot/route');

    dbMock.select
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'client-1' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: 'engagement-1', lifecycleStage: 'ready_for_first_work' }]) }) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
        { status: 'todo', visibleToClient: true, isBlocking: true },
        { status: 'done', visibleToClient: true, isBlocking: false },
      ]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
        { fileType: 'identity_document' },
        { fileType: 'proof_of_address' },
      ]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
        { status: 'sent' },
        { status: 'draft' },
      ]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
        { outcome: 'deleted' },
        { outcome: 'updated' },
        { outcome: 'verified' },
      ]) }) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([
        { id: 'pull-1' },
        { id: 'pull-2' },
      ]) }) });

    const response = await GET(new NextRequest('http://localhost/api/portal/progress-snapshot'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.snapshot).toMatchObject({
      engagement_id: 'engagement-1',
      lifecycle_stage: 'ready_for_first_work',
      tasks: {
        total_visible: 2,
        open: 1,
        blocking_open: 1,
      },
      documents: {
        completed: 2,
        total_required: 2,
      },
      dispute_cycles: {
        total: 2,
        active: 1,
      },
      outcomes: {
        deleted: 1,
        updated: 1,
        verified: 1,
      },
      report_history: {
        pulls: 2,
      },
    });
  }, 30000);
});

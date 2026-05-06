import { describe, expect, it } from 'vitest';
import { buildClientProgressSnapshot } from '@/lib/client-progress-snapshot';

describe('buildClientProgressSnapshot', () => {
  it('computes client-facing progress from operational records', () => {
    expect(buildClientProgressSnapshot({
      engagement: { id: 'engagement-1', lifecycleStage: 'ready_for_first_work' },
      tasks: [
        { status: 'todo', visibleToClient: true, isBlocking: true },
        { status: 'done', visibleToClient: true, isBlocking: false },
        { status: 'todo', visibleToClient: false, isBlocking: true },
      ],
      documentChecklist: [{ completed: true }, { completed: false }],
      cycles: [{ status: 'sent' }, { status: 'draft' }],
      disputes: [{ outcome: 'deleted' }, { outcome: 'updated' }, { outcome: 'verified' }],
      reportPulls: [{ id: 'pull-1' }, { id: 'pull-2' }],
    })).toMatchObject({
      engagement_id: 'engagement-1',
      lifecycle_stage: 'ready_for_first_work',
      tasks: { total_visible: 2, open: 1, blocking_open: 1 },
      documents: { completed: 1, total_required: 2 },
      dispute_cycles: { total: 2, active: 1 },
      outcomes: { deleted: 1, updated: 1, verified: 1 },
      report_history: { pulls: 2 },
    });
  });
});

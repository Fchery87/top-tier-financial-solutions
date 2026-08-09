import { describe, expect, it } from 'vitest';
import { buildWorkspaceClientRecord } from '@/lib/workspace-client-record';

describe('buildWorkspaceClientRecord', () => {
  it('derives display-safe identity, actionable work, readiness, and record counts', () => {
    const record = buildWorkspaceClientRecord({
      client: {
        id: 'client-1',
        firstName: null,
        lastName: null,
        email: 'client@example.com',
        status: 'active',
      },
      readiness: {
        isReadyForRound: false,
        blockingTasks: 1,
        unfinishedClientTasks: 2,
        atRisk: true,
      },
      counts: {
        reports: 2,
        disputes: 3,
        tasks: 4,
        notes: 5,
      },
      responseReview: {
        isImmutable: true,
      },
    });

    expect(record.identity.displayName).toBe('Client');
    expect(record.identity.email).toBe('client@example.com');
    expect(record.actionableWork).toEqual({
      blockingTasks: 1,
      unfinishedClientTasks: 2,
      needsAttention: true,
    });
    expect(record.readiness).toEqual({
      isReadyForRound: false,
      atRisk: true,
    });
    expect(record.linkedRecordCounts).toEqual({
      reports: 2,
      disputes: 3,
      tasks: 4,
      notes: 5,
    });
    expect(record.responseReview.isImmutable).toBe(true);
  });

  it('represents missing optional readiness without inventing actionable work', () => {
    const record = buildWorkspaceClientRecord({
      client: {
        id: 'client-2',
        firstName: 'Ada',
        lastName: null,
        email: null,
        status: 'pending',
      },
      readiness: null,
      counts: { reports: 0, disputes: 0, tasks: 0, notes: 0 },
      responseReview: { isImmutable: false },
    });

    expect(record.identity.displayName).toBe('Ada');
    expect(record.actionableWork.needsAttention).toBe(false);
    expect(record.readiness).toEqual({ isReadyForRound: false, atRisk: false });
    expect(record.responseReview.isImmutable).toBe(false);
  });
});

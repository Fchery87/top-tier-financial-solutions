type EngagementRecord = {
  id: string;
  lifecycleStage: string | null;
} | null | undefined;

type TaskRecord = {
  status: string | null;
  visibleToClient: boolean | null;
  isBlocking: boolean | null;
};

type ChecklistItem = {
  completed: boolean;
};

type CycleRecord = {
  status: string | null;
};

type DisputeOutcomeRecord = {
  outcome: string | null;
};

type ReportPullRecord = {
  id: string;
};

export function buildClientProgressSnapshot(params: {
  engagement: EngagementRecord;
  tasks: TaskRecord[];
  documentChecklist: ChecklistItem[];
  cycles: CycleRecord[];
  disputes: DisputeOutcomeRecord[];
  reportPulls: ReportPullRecord[];
}) {
  const clientVisibleTasks = params.tasks.filter((task) => task.visibleToClient);
  const openTasks = clientVisibleTasks.filter((task) => task.status !== 'done');
  const activeCycleStatuses = new Set(['ready', 'sent', 'in_progress']);
  const outcomes = params.disputes.reduce(
    (acc, dispute) => {
      if (dispute.outcome === 'deleted') acc.deleted += 1;
      if (dispute.outcome === 'updated') acc.updated += 1;
      if (dispute.outcome === 'verified') acc.verified += 1;
      return acc;
    },
    { deleted: 0, updated: 0, verified: 0 },
  );

  return {
    engagement_id: params.engagement?.id ?? null,
    lifecycle_stage: params.engagement?.lifecycleStage ?? null,
    tasks: {
      total_visible: clientVisibleTasks.length,
      open: openTasks.length,
      blocking_open: openTasks.filter((task) => task.isBlocking).length,
    },
    documents: {
      completed: params.documentChecklist.filter((item) => item.completed).length,
      total_required: params.documentChecklist.length,
    },
    dispute_cycles: {
      total: params.cycles.length,
      active: params.cycles.filter((cycle) => activeCycleStatuses.has(cycle.status || '')).length,
    },
    outcomes,
    report_history: {
      pulls: params.reportPulls.length,
    },
  };
}

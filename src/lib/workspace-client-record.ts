export interface WorkspaceClientRecordInput {
  client: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    status: string;
  };
  readiness: {
    isReadyForRound: boolean;
    blockingTasks: number;
    unfinishedClientTasks: number;
    atRisk: boolean;
  } | null;
  counts: {
    reports: number;
    disputes: number;
    tasks: number;
    notes: number;
  };
  responseReview: {
    isImmutable: boolean;
  };
}

export interface WorkspaceClientRecord {
  identity: {
    id: string;
    displayName: string;
    email: string | null;
    status: string;
  };
  actionableWork: {
    blockingTasks: number;
    unfinishedClientTasks: number;
    needsAttention: boolean;
  };
  readiness: {
    isReadyForRound: boolean;
    atRisk: boolean;
  };
  linkedRecordCounts: WorkspaceClientRecordInput['counts'];
  responseReview: WorkspaceClientRecordInput['responseReview'];
}

function getDisplayName(firstName: string | null, lastName: string | null): string {
  const name = [firstName, lastName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ');
  return name || 'Client';
}

export function buildWorkspaceClientRecord(
  input: WorkspaceClientRecordInput,
): WorkspaceClientRecord {
  const readiness = input.readiness ?? {
    isReadyForRound: false,
    blockingTasks: 0,
    unfinishedClientTasks: 0,
    atRisk: false,
  };

  return {
    identity: {
      id: input.client.id,
      displayName: getDisplayName(input.client.firstName, input.client.lastName),
      email: input.client.email,
      status: input.client.status,
    },
    actionableWork: {
      blockingTasks: readiness.blockingTasks,
      unfinishedClientTasks: readiness.unfinishedClientTasks,
      needsAttention:
        readiness.blockingTasks > 0 || readiness.unfinishedClientTasks > 0 || readiness.atRisk,
    },
    readiness: {
      isReadyForRound: readiness.isReadyForRound,
      atRisk: readiness.atRisk,
    },
    linkedRecordCounts: input.counts,
    responseReview: input.responseReview,
  };
}

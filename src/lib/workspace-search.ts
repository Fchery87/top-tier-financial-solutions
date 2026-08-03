export type WorkspaceClientSearchRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string | null;
  [key: string]: unknown;
};

export type WorkspaceDisputeSearchRecord = {
  id: string;
  clientName: string;
  creditorName: string | null;
  disputeReason: string;
  bureau: string;
  status: string | null;
  round: number | null;
  [key: string]: unknown;
};

export type WorkspaceSearchResult =
  | {
      kind: 'client';
      id: string;
      label: string;
      description: string;
      href: string;
    }
  | {
      kind: 'dispute';
      id: string;
      label: string;
      description: string;
      href: string;
    };

type SearchOptions = {
  query: string;
  clients: WorkspaceClientSearchRecord[];
  disputes: WorkspaceDisputeSearchRecord[];
  limitPerKind?: number;
};

export function normalizeWorkspaceSearchQuery(query: string): string | null {
  const normalized = query.trim().toLocaleLowerCase();
  return normalized.length >= 2 ? normalized : null;
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function matchRank(query: string, values: string[]): number | null {
  const normalizedValues = values.map((value) => value.toLocaleLowerCase());

  if (normalizedValues.some((value) => value === query)) return 0;
  if (normalizedValues.some((value) => value.startsWith(query))) return 1;
  if (normalizedValues.some((value) => value.includes(query))) return 2;

  return null;
}

function sortAndLimit<T>(
  rows: T[],
  rank: (row: T) => number | null,
  limit: number,
): T[] {
  return rows
    .map((row, index) => ({ row, index, rank: rank(row) }))
    .filter((entry): entry is { row: T; index: number; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.row);
}

function formatStatus(status: string | null): string {
  return titleCase(status || 'Unknown');
}

function toClientResult(client: WorkspaceClientSearchRecord): WorkspaceSearchResult {
  return {
    kind: 'client',
    id: client.id,
    label: `${client.firstName} ${client.lastName}`.trim(),
    description: `${client.email} · ${formatStatus(client.status)}`,
    href: `/workspace/clients/${encodeURIComponent(client.id)}`,
  };
}

function toDisputeResult(dispute: WorkspaceDisputeSearchRecord): WorkspaceSearchResult {
  const subject = dispute.creditorName || dispute.disputeReason;
  const round = dispute.round === null ? 'Round unknown' : `Round ${dispute.round}`;

  return {
    kind: 'dispute',
    id: dispute.id,
    label: `${dispute.clientName} — ${subject}`,
    description: `${titleCase(dispute.bureau)} · ${round} · ${formatStatus(dispute.status)}`,
    href: `/workspace/disputes?dispute=${encodeURIComponent(dispute.id)}`,
  };
}

export function searchWorkspaceRecords({
  query,
  clients,
  disputes,
  limitPerKind = 5,
}: SearchOptions): WorkspaceSearchResult[] {
  const normalizedQuery = normalizeWorkspaceSearchQuery(query);
  if (!normalizedQuery || limitPerKind < 1) return [];

  const matchingClients = sortAndLimit(
    clients,
    (client) => matchRank(normalizedQuery, [
      client.id,
      client.firstName,
      client.lastName,
      `${client.firstName} ${client.lastName}`,
      client.email,
    ]),
    limitPerKind,
  );
  const matchingDisputes = sortAndLimit(
    disputes,
    (dispute) => matchRank(normalizedQuery, [
      dispute.id,
      dispute.clientName,
      dispute.creditorName || '',
      dispute.disputeReason,
      dispute.bureau,
      dispute.status || '',
    ]),
    limitPerKind,
  );

  return [
    ...matchingClients.map(toClientResult),
    ...matchingDisputes.map(toDisputeResult),
  ];
}

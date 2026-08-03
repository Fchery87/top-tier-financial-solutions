type DisputeWithId = { id: string };

export function findDisputeFromQuery<T extends DisputeWithId>(
  disputes: T[],
  queryId: string | null,
): T | null {
  if (!queryId) return null;
  return disputes.find((dispute) => dispute.id === queryId) || null;
}

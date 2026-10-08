type RequestLogFields = {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  actorId?: string | null;
};

export function logRequest(fields: RequestLogFields): void {
  const line = {
    requestId: fields.requestId,
    method: fields.method,
    path: fields.path,
    status: fields.status,
    durationMs: fields.durationMs,
    ...(fields.actorId ? { actorId: fields.actorId } : {}),
  };
  console.log(JSON.stringify(line));
}

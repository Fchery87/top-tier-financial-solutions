import { randomUUID } from 'crypto';

import { adminActivityLog } from '@/db/schema';

export type AdminActivitySubjectType =
  | 'user_role'
  | 'letter_library'
  | 'settings'
  | 'automation'
  | 'client_record'
  | 'credit_report'
  | 'dispute_letter'
  | 'service_engagement';

export interface AdminActivityInput {
  actorUserId: string | null;
  action: string;
  subjectType: AdminActivitySubjectType;
  subjectId?: string | null;
  metadata?: Record<string, unknown>;
}

type AdminActivityInsert = typeof adminActivityLog.$inferInsert;

export interface DatabaseExecutor {
  insert(table: typeof adminActivityLog): {
    values(values: AdminActivityInsert): PromiseLike<unknown>;
  };
}

export async function recordAdminActivity(
  executor: DatabaseExecutor,
  input: AdminActivityInput,
): Promise<void> {
  await executor.insert(adminActivityLog).values({
    id: randomUUID(),
    actorUserId: input.actorUserId,
    action: input.action,
    subjectType: input.subjectType,
    subjectId: input.subjectId ?? null,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
  });
}

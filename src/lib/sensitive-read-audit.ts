import 'server-only';

import {
  recordAdminActivity,
  type DatabaseExecutor,
} from '@/lib/admin-activity';

interface SensitiveReadBase {
  actorUserId: string;
  route: string;
  requestId: string;
}

export type SensitiveReadInput =
  | (SensitiveReadBase & {
    kind: 'client_record';
    clientId: string;
  })
  | (SensitiveReadBase & {
    kind: 'credit_report';
    creditReportId: string;
  })
  | (SensitiveReadBase & {
    kind: 'dispute_letter';
    disputeId: string;
  });

export async function recordSensitiveRead(
  executor: DatabaseExecutor,
  input: SensitiveReadInput,
): Promise<void> {
  const metadata = {
    requestId: input.requestId,
    route: input.route,
  };

  switch (input.kind) {
    case 'client_record':
      await recordAdminActivity(executor, {
        actorUserId: input.actorUserId,
        action: 'client_record.viewed',
        subjectType: 'client_record',
        subjectId: input.clientId,
        metadata,
      });
      return;
    case 'credit_report':
      await recordAdminActivity(executor, {
        actorUserId: input.actorUserId,
        action: 'credit_report.viewed',
        subjectType: 'credit_report',
        subjectId: input.creditReportId,
        metadata,
      });
      return;
    case 'dispute_letter':
      await recordAdminActivity(executor, {
        actorUserId: input.actorUserId,
        action: 'dispute_letter.viewed',
        subjectType: 'dispute_letter',
        subjectId: input.disputeId,
        metadata,
      });
      return;
    default: {
      const _exhaustive: never = input;
      return _exhaustive;
    }
  }
}

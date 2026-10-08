import { describe, expect, it, vi } from 'vitest';

import { recordSensitiveRead, type SensitiveReadInput } from '@/lib/sensitive-read-audit';

describe('recordSensitiveRead', () => {
  it('writes only the safe route and request identifier metadata', async () => {
    const values = vi.fn(async () => undefined);
    const executor = {
      insert: vi.fn(() => ({ values })),
    };

    await recordSensitiveRead(executor, {
      kind: 'credit_report',
      actorUserId: 'admin-1',
      creditReportId: 'report-1',
      route: '/api/workspace/clients/client-1/audit-report',
      requestId: 'request-1',
    });

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'admin-1',
      action: 'credit_report.viewed',
      subjectType: 'credit_report',
      subjectId: 'report-1',
      metadata: JSON.stringify({
        requestId: 'request-1',
        route: '/api/workspace/clients/client-1/audit-report',
      }),
    }));
  });

  it('only accepts the resource identifier for the selected read kind', () => {
    const input = {
      kind: 'dispute_letter',
      actorUserId: 'admin-1',
      disputeId: 'dispute-1',
      route: '/api/workspace/disputes/dispute-1/letter',
      requestId: 'request-1',
    } satisfies SensitiveReadInput;

    expect(input).toMatchObject({ disputeId: 'dispute-1' });
  });
});

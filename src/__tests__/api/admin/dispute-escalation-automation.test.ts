import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const requireCapabilityMock = vi.hoisted(() => vi.fn());
const runDisputeEscalationAutomationMock = vi.hoisted(() => vi.fn());
const writeDisputeEscalationFailureMock = vi.hoisted(() => vi.fn());
const dbMock = vi.hoisted(() => ({ transaction: vi.fn() }));

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/dispute-escalation-runner', () => ({
  runDisputeEscalationAutomation: runDisputeEscalationAutomationMock,
  writeDisputeEscalationFailure: writeDisputeEscalationFailureMock,
}));

describe('POST /api/workspace/automation/dispute-escalations/run', () => {
  beforeEach(() => vi.resetAllMocks());

  it('denies a staff-equivalent request without settings:write', async () => {
    requireCapabilityMock.mockResolvedValue(null);
    const { POST } = await import('@/app/api/workspace/automation/dispute-escalations/run/route');

    const response = await POST(new NextRequest('http://localhost/api/workspace/automation/dispute-escalations/run', {
      method: 'POST',
      body: JSON.stringify({ dryRun: true }),
    }));

    expect(response.status).toBe(403);
    expect(requireCapabilityMock).toHaveBeenCalledWith('settings:write');
    expect(runDisputeEscalationAutomationMock).not.toHaveBeenCalled();
  });
});

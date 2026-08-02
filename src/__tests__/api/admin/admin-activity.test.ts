import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  insert: vi.fn(),
  transaction: vi.fn(),
}));
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const recordAdminActivityMock = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => ({ api: { getSession: vi.fn() } }));
const setSettingMock = vi.hoisted(() => vi.fn());
const updateLLMConfigMock = vi.hoisted(() => vi.fn());
const getLLMConfigMock = vi.hoisted(() => vi.fn());
const runDisputeEscalationAutomationMock = vi.hoisted(() => vi.fn());

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/admin-activity', () => ({ recordAdminActivity: recordAdminActivityMock }));
vi.mock('@/lib/auth', () => ({ auth: authMock }));
vi.mock('@/lib/settings-service', () => ({
  clearSettingsCache: vi.fn(),
  getLLMConfig: getLLMConfigMock,
  getSettingsByCategory: vi.fn(),
  setSetting: setSettingMock,
  updateLLMConfig: updateLLMConfigMock,
}));
vi.mock('@/lib/dispute-escalation-runner', () => ({
  runDisputeEscalationAutomation: runDisputeEscalationAutomationMock,
  writeDisputeEscalationFailure: vi.fn(),
}));
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

describe('administration activity audit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    dbMock.transaction.mockImplementation(async (callback: (executor: typeof dbMock) => Promise<unknown>) => callback(dbMock));
    dbMock.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    requireCapabilityMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
    authMock.api.getSession.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@example.com', role: 'super_admin' } });
    recordAdminActivityMock.mockResolvedValue(undefined);
    setSettingMock.mockResolvedValue(undefined);
    updateLLMConfigMock.mockResolvedValue(undefined);
    getLLMConfigMock.mockResolvedValue({ provider: 'google', model: 'gemini-2.5-flash' });
    runDisputeEscalationAutomationMock.mockResolvedValue({ checked: 1, escalated: 0 });
  });

  it('writes a transactional library-create audit row without template content or prompt text', async () => {
    const { POST } = await import('@/app/api/admin/letter-library/route');
    const content = 'Full generated letter content must never enter the audit log.';
    const promptContext = 'Private prompting strategy must never enter the audit log.';

    const response = await POST(new NextRequest('http://localhost/api/admin/letter-library', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Round one bureau dispute',
        methodology: 'factual',
        content,
        prompt_context: promptContext,
      }),
    }));

    expect(response.status).toBe(201);
    expect(dbMock.transaction).toHaveBeenCalledOnce();
    expect(recordAdminActivityMock).toHaveBeenCalledWith(
      dbMock,
      expect.objectContaining({
        actorUserId: 'admin-1',
        action: 'letter_library.created',
        subjectType: 'letter_library',
        metadata: expect.objectContaining({ changedFields: expect.any(Array) }),
      }),
    );
    const auditInput = recordAdminActivityMock.mock.calls[0]?.[1];
    expect(JSON.stringify(auditInput)).not.toContain(content);
    expect(JSON.stringify(auditInput)).not.toContain(promptContext);
  });

  it('writes a transactional setting-update audit row without the setting value', async () => {
    const { PUT } = await import('@/app/api/admin/settings/route');
    const value = 'secret configuration value';

    const response = await PUT(new NextRequest('http://localhost/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({ key: 'integrations.secret', value, type: 'string', isSecret: true }),
    }));

    expect(response.status).toBe(200);
    expect(dbMock.transaction).toHaveBeenCalledOnce();
    expect(recordAdminActivityMock).toHaveBeenCalledWith(
      dbMock,
      expect.objectContaining({
        action: 'settings.updated',
        subjectType: 'settings',
        subjectId: 'integrations.secret',
        metadata: expect.not.objectContaining({ value }),
      }),
    );
    expect(JSON.stringify(recordAdminActivityMock.mock.calls[0]?.[1])).not.toContain(value);
  });

  it('writes a transactional LLM audit row without the API key', async () => {
    const { PUT } = await import('@/app/api/admin/settings/llm/route');
    const apiKey = 'private-api-key';

    const response = await PUT(new NextRequest('http://localhost/api/admin/settings/llm', {
      method: 'PUT',
      body: JSON.stringify({ provider: 'openai', apiKey }),
    }));

    expect(response.status).toBe(200);
    expect(dbMock.transaction).toHaveBeenCalledOnce();
    expect(recordAdminActivityMock).toHaveBeenCalledWith(
      dbMock,
      expect.objectContaining({
        action: 'settings.llm.updated',
        subjectType: 'settings',
        subjectId: 'llm',
        metadata: { changedFields: ['apiKey', 'provider'] },
      }),
    );
    expect(JSON.stringify(recordAdminActivityMock.mock.calls[0]?.[1])).not.toContain(apiKey);
  });

  it('writes a transactional automation-run audit row', async () => {
    const { POST } = await import('@/app/api/admin/automation/dispute-escalations/run/route');

    const response = await POST(new NextRequest('http://localhost/api/admin/automation/dispute-escalations/run', {
      method: 'POST',
      body: JSON.stringify({ dryRun: true }),
    }));

    expect(response.status).toBe(200);
    expect(dbMock.transaction).toHaveBeenCalledOnce();
    expect(recordAdminActivityMock).toHaveBeenCalledWith(
      dbMock,
      expect.objectContaining({
        action: 'automation.dispute_escalations.run',
        subjectType: 'automation',
        metadata: { dryRun: true },
      }),
    );
  });
});

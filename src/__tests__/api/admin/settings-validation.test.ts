import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const dbMock = vi.hoisted(() => ({
  transaction: vi.fn(),
}));
const requireCapabilityMock = vi.hoisted(() => vi.fn());
const settingsServiceMock = vi.hoisted(() => ({
  clearSettingsCache: vi.fn(),
  deleteSetting: vi.fn(),
  getLLMConfig: vi.fn(),
  getSettingsByCategory: vi.fn(),
  setSetting: vi.fn(),
  updateLLMConfig: vi.fn(),
}));

vi.mock('@/db/client', () => ({ db: dbMock }));
vi.mock('@/lib/admin-session', () => ({ requireCapability: requireCapabilityMock }));
vi.mock('@/lib/settings-service', () => settingsServiceMock);
vi.mock('@/lib/admin-activity', () => ({ recordAdminActivity: vi.fn() }));

function jsonRequest(url: string, method: 'POST' | 'PUT', body: unknown) {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('settings write validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com', role: 'super_admin' });
  });

  it('rejects unsafe settings writes before opening a transaction', async () => {
    const { POST, PUT } = await import('@/app/api/admin/settings/route');
    const invalidPayloads = [
      [],
      { key: 'contains spaces', type: 'string', value: 'value' },
      { key: 'setting_key', type: 'invalid', value: 'value' },
      { key: 'setting_key', type: 'json', value: { one: { two: { three: { four: { five: { six: true } } } } } } },
      { key: 'setting_key', type: 'json', value: Array.from({ length: 101 }, () => true) },
      { key: 'setting_key', type: 'string', value: 'value', category: 'x'.repeat(101) },
      { key: 'setting_key', type: 'string', value: 'value', description: 'x'.repeat(501) },
    ];

    for (const payload of invalidPayloads) {
      const putResponse = await PUT(jsonRequest('http://localhost/api/admin/settings', 'PUT', payload));
      const postResponse = await POST(jsonRequest('http://localhost/api/admin/settings', 'POST', payload));
      expect(putResponse.status).toBe(400);
      expect(postResponse.status).toBe(400);
    }

    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('rejects unsafe LLM configuration updates before opening a transaction', async () => {
    const { PUT } = await import('@/app/api/admin/settings/llm/route');
    const invalidPayloads = [
      [],
      { provider: 'unsupported' },
      { model: 'x'.repeat(501) },
      { apiKey: 'x'.repeat(10_001) },
      { apiEndpoint: 'http://insecure.example.com' },
      { temperature: -0.1 },
      { temperature: 2.1 },
      { maxTokens: 0 },
      { maxTokens: 1.5 },
      { maxTokens: 100_001 },
    ];

    for (const payload of invalidPayloads) {
      const response = await PUT(jsonRequest('http://localhost/api/admin/settings/llm', 'PUT', payload));
      expect(response.status).toBe(400);
    }

    expect(dbMock.transaction).not.toHaveBeenCalled();
  });

  it('does not return an API key after a valid LLM update', async () => {
    dbMock.transaction.mockImplementation(async (operation) => operation({}));
    settingsServiceMock.getLLMConfig.mockResolvedValue({
      provider: 'openai',
      model: 'gpt-5',
      apiKey: 'secret-api-key-value',
      temperature: 0.7,
      maxTokens: 4096,
    });
    const { PUT } = await import('@/app/api/admin/settings/llm/route');

    const response = await PUT(jsonRequest('http://localhost/api/admin/settings/llm', 'PUT', {
      apiKey: 'secret-api-key-value',
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.config.apiKey).toBeUndefined();
    expect(body.config.hasApiKey).toBe(true);
    expect(JSON.stringify(body)).not.toContain('secret-api-key-value');
  });
});

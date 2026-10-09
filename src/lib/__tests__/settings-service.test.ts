// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encrypt } from '@/lib/encryption';

const dbMock = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock('@/db/client', () => ({ db: dbMock }));

import {
  clearSettingsCache,
  getLLMConfig,
  type SettingsMutationExecutor,
  updateLLMConfig,
} from '@/lib/settings-service';

describe('LLM API key storage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearSettingsCache();
  });

  it('persists LLM API keys as versioned ciphertext', async () => {
    const valuesMock = vi.fn().mockResolvedValue(undefined);
    const executor = createSettingsExecutor({
      existingRows: [],
      valuesMock,
    });

    await updateLLMConfig({ apiKey: 'provider-secret-value' }, 'admin-1', executor);

    expect(valuesMock).toHaveBeenCalledWith(expect.objectContaining({
      settingKey: 'llm.api_key',
      settingValue: expect.stringMatching(/^v3:test:/),
      isSecret: true,
    }));
    expect(valuesMock).not.toHaveBeenCalledWith(expect.objectContaining({
      settingValue: 'provider-secret-value',
    }));
  });

  it('returns a decrypted versioned LLM API key only to server-side callers', async () => {
    const encryptedKey = encrypt('provider-secret-value');
    const limitMock = vi.fn()
      .mockResolvedValueOnce([{ settingType: 'string', settingValue: 'google' }])
      .mockResolvedValueOnce([{ settingType: 'string', settingValue: 'gpt-5' }])
      .mockResolvedValueOnce([{ settingType: 'string', settingValue: encryptedKey }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    dbMock.select.mockReturnValue(createSelectChain(limitMock));

    await expect(getLLMConfig()).resolves.toMatchObject({
      provider: 'google',
      model: 'gpt-5',
      apiKey: 'provider-secret-value',
    });
  });
});

function settingKeyOf(condition: unknown): string | undefined {
  const chunks = (condition as { queryChunks?: unknown[] })?.queryChunks || [];
  for (const chunk of chunks) {
    const value = (chunk as { value?: unknown })?.value;
    if (typeof value === 'string' && value.startsWith('llm.')) return value;
  }
  return undefined;
}

function mockSettings(values: Record<string, { settingType: string; settingValue: string }>) {
  dbMock.select.mockImplementation(() => ({
    from: () => ({
      where: (condition: unknown) => ({
        limit: async () => {
          const key = settingKeyOf(condition);
          return key && values[key] ? [values[key]] : [];
        },
      }),
    }),
  }));
}

const str = (settingValue: string) => ({ settingType: 'string', settingValue });

describe('getLLMConfig API protocol', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    clearSettingsCache();
  });

  it('infers the Anthropic protocol for a custom endpoint whose path ends in /anthropic', async () => {
    mockSettings({
      'llm.provider': str('custom'),
      'llm.model': str('deepseek-flash'),
      'llm.api_endpoint': str('https://api.deepseek.com/anthropic'),
    });

    await expect(getLLMConfig()).resolves.toMatchObject({ provider: 'custom', apiProtocol: 'anthropic' });
  });

  it('infers the OpenAI protocol for any other custom endpoint', async () => {
    mockSettings({
      'llm.provider': str('custom'),
      'llm.model': str('deepseek-flash'),
      'llm.api_endpoint': str('https://api.deepseek.com/v1'),
    });

    await expect(getLLMConfig()).resolves.toMatchObject({ apiProtocol: 'openai' });
  });

  it('uses an explicit llm.api_protocol setting over inference', async () => {
    mockSettings({
      'llm.provider': str('custom'),
      'llm.model': str('m'),
      'llm.api_endpoint': str('https://api.example.com/anthropic'),
      'llm.api_protocol': str('openai'),
    });

    await expect(getLLMConfig()).resolves.toMatchObject({ apiProtocol: 'openai' });
  });

  it('has no default model for a custom provider', async () => {
    mockSettings({
      'llm.provider': str('custom'),
      'llm.api_endpoint': str('https://api.deepseek.com/anthropic'),
    });

    await expect(getLLMConfig()).resolves.toMatchObject({ model: '' });
  });

  it('sets no protocol for first-party providers', async () => {
    mockSettings({ 'llm.provider': str('google') });

    const config = await getLLMConfig();
    expect(config.apiProtocol).toBeUndefined();
  });
});

function createSettingsExecutor({
  existingRows,
  valuesMock,
}: {
  existingRows: Array<{ description: string | null }>;
  valuesMock: (values: InsertedSetting) => unknown;
}): SettingsMutationExecutor {
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => existingRows,
        }),
      }),
    }),
    insert: () => ({
      values: async (values) => {
        valuesMock(values);
      },
    }),
    update: () => ({
      set: () => ({
        where: async () => undefined,
      }),
    }),
    delete: () => ({
      where: async () => undefined,
    }),
  };
}

type InsertedSetting = Parameters<ReturnType<SettingsMutationExecutor['insert']>['values']>[0];

function createSelectChain(limitMock: ReturnType<typeof vi.fn>) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({ limit: limitMock })),
    })),
  };
}

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

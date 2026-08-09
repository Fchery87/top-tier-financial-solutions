/**
 * System Settings Service
 * 
 * Manages application-wide configuration settings stored in the database.
 * Provides a caching layer for frequently accessed settings like LLM configuration.
 */

import { db } from '@/db/client';
import { systemSettings } from '@/db/schema';
import { eq, type SQL } from 'drizzle-orm';
import { decrypt, encrypt, isCiphertextValue } from '@/lib/encryption';

type SettingValue = string | number | boolean | Record<string, unknown> | unknown[] | null;
type SettingMutationRow = Pick<typeof systemSettings.$inferSelect, 'description'>;
type SettingsMutationValues = Partial<typeof systemSettings.$inferInsert>;

export type SettingsMutationExecutor = {
  select(): {
    from(table: typeof systemSettings): {
      where(condition: SQL): {
        limit(limit: number): Promise<SettingMutationRow[]>;
      };
    };
  };
  insert(table: typeof systemSettings): {
    values(values: typeof systemSettings.$inferInsert): Promise<unknown>;
  };
  update(table: typeof systemSettings): {
    set(values: SettingsMutationValues): {
      where(condition: SQL): Promise<unknown>;
    };
  };
  delete(table: typeof systemSettings): {
    where(condition: SQL): Promise<unknown>;
  };
};

export const DEFAULT_LLM_MODELS = {
  google: 'gemini-2.5-flash',
  openai: 'gpt-5',
  anthropic: 'claude-sonnet-5',
  zhipu: 'glm-4-flash',
  custom: 'gemini-2.5-flash',
} as const;
type CachedSetting = { value: SettingValue; expiresAt: number };

// In-memory cache for settings (TTL: 5 minutes)
const settingsCache = new Map<string, CachedSetting>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const DEFAULT_LLM_PROVIDER: LLMConfig['provider'] = 'google';
export const DEFAULT_LLM_TEMPERATURE = 0.7;
export const DEFAULT_LLM_MAX_TOKENS = 4096;
const LLM_API_KEY_SETTING = 'llm.api_key';

export function getDefaultLLMModel(provider: LLMConfig['provider']): string {
  return DEFAULT_LLM_MODELS[provider] || DEFAULT_LLM_MODELS.google;
}

/**
 * Get a setting value by key
 * Uses cache when available, falls back to database
 */
export async function getSetting(key: string): Promise<SettingValue> {
  // Check cache first
  const cached = settingsCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  // Fetch from database
  const setting = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.settingKey, key))
    .limit(1);

  if (setting.length === 0) {
    return null;
  }

  const settingData = setting[0];
  let parsedValue: SettingValue;

  // Parse value based on type
  switch (settingData.settingType) {
    case 'number':
      parsedValue = parseFloat(settingData.settingValue || '0');
      break;
    case 'boolean':
      parsedValue = settingData.settingValue === 'true';
      break;
    case 'json':
      try {
        parsedValue = JSON.parse(settingData.settingValue || '{}');
      } catch {
        parsedValue = {};
      }
      break;
    case 'string':
    default:
      parsedValue = settingData.settingValue;
  }

  if (key === LLM_API_KEY_SETTING) {
    parsedValue = decryptLlmApiKey(parsedValue);
  }

  // Cache the value
  settingsCache.set(key, {
    value: parsedValue,
    expiresAt: Date.now() + CACHE_TTL,
  });

  return parsedValue;
}

/**
 * Get a setting with a default fallback
 */
export async function getSettingWithDefault<T>(key: string, defaultValue: T): Promise<T> {
  const value = await getSetting(key);
  return value !== null ? (value as T) : defaultValue;
}

/**
 * Set a setting value
 * Clears cache for that key
 */
export async function setSetting(
  key: string,
  value: SettingValue,
  type: 'string' | 'number' | 'boolean' | 'json',
  category: string = 'general',
  description?: string,
  isSecret: boolean = false,
  userId?: string,
  executor: SettingsMutationExecutor = db,
): Promise<void> {
  let stringValue: string;

  // Convert value to string based on type
  switch (type) {
    case 'number':
      stringValue = String(value);
      break;
    case 'boolean':
      stringValue = value ? 'true' : 'false';
      break;
    case 'json':
      stringValue = JSON.stringify(value);
      break;
    case 'string':
    default:
      stringValue = String(value);
  }

  if (key === LLM_API_KEY_SETTING) {
    stringValue = encrypt(stringValue) ?? '';
  }

  // Check if setting exists
  const existing = await executor
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.settingKey, key))
    .limit(1);

  if (existing.length > 0) {
    // Update existing
    await executor
      .update(systemSettings)
      .set({
        settingValue: stringValue,
        settingType: type,
        category,
        description: description || existing[0].description,
        isSecret,
        lastModifiedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(systemSettings.settingKey, key));
  } else {
    // Insert new
    const { randomUUID } = await import('crypto');
    await executor.insert(systemSettings).values({
      id: randomUUID(),
      settingKey: key,
      settingValue: stringValue,
      settingType: type,
      category,
      description,
      isSecret,
      lastModifiedBy: userId,
    });
  }

  // Clear cache
  settingsCache.delete(key);
}

function decryptLlmApiKey(value: SettingValue): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  if (!isCiphertextValue(value)) {
    return value;
  }

  try {
    return decrypt(value);
  } catch {
    return null;
  }
}

/**
 * Delete a setting
 */
export async function deleteSetting(
  key: string,
  executor: SettingsMutationExecutor = db,
): Promise<void> {
  await executor.delete(systemSettings).where(eq(systemSettings.settingKey, key));
  settingsCache.delete(key);
}

/**
 * Clear the settings cache
 */
export function clearSettingsCache(): void {
  settingsCache.clear();
}

export async function getSettingsByCategory(category: string): Promise<Array<typeof systemSettings.$inferSelect & { parsedValue: SettingValue }>> {
  const settings = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.category, category));

  return settings.map((setting) => {
    let parsedValue: SettingValue;
    switch (setting.settingType) {
      case 'number':
        parsedValue = parseFloat(setting.settingValue || '0');
        break;
      case 'boolean':
        parsedValue = setting.settingValue === 'true';
        break;
      case 'json':
        try {
          parsedValue = JSON.parse(setting.settingValue || '{}');
        } catch {
          parsedValue = {};
        }
        break;
      default:
        parsedValue = setting.settingValue;
    }

    return {
      ...setting,
      parsedValue,
    };
  });
}

// ============================================
// LLM Configuration Helpers
// ============================================

export interface LLMConfig {
  provider: 'google' | 'openai' | 'anthropic' | 'zhipu' | 'custom';
  model: string;
  apiKey?: string; // From env or database
  apiEndpoint?: string; // For custom providers
  temperature?: number;
  maxTokens?: number;
}

/**
 * Get the current LLM configuration
 * Falls back to environment variables if not set in database
 */
export async function getLLMConfig(): Promise<LLMConfig> {
  const provider = await getSettingWithDefault<string>('llm.provider', 'google') as LLMConfig['provider'];
  const model = await getSettingWithDefault<string>(
    'llm.model',
    getDefaultLLMModel(provider)
  );
  const apiKeyFromDb = await getSetting('llm.api_key');
  const apiEndpoint = await getSetting('llm.api_endpoint');
  const temperature = await getSettingWithDefault<number>('llm.temperature', 0.7);
  const maxTokens = await getSettingWithDefault<number>('llm.max_tokens', 4096);

  // Prefer database API key, fall back to environment variable
  let apiKey: string | undefined = typeof apiKeyFromDb === 'string' ? apiKeyFromDb : undefined;
  if (!apiKey) {
    switch (provider) {
      case 'google':
        apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
        break;
      case 'openai':
        apiKey = process.env.OPENAI_API_KEY;
        break;
      case 'anthropic':
        apiKey = process.env.ANTHROPIC_API_KEY;
        break;
      case 'zhipu':
        apiKey = process.env.ZHIPU_API_KEY;
        break;
      default:
        apiKey = undefined;
    }
  }

  return {
    provider,
    model,
    apiKey,
    apiEndpoint: typeof apiEndpoint === 'string' ? apiEndpoint : undefined,
    temperature,
    maxTokens,
  };
}

/**
 * Update LLM configuration
 */
export async function updateLLMConfig(
  config: Partial<LLMConfig>,
  userId?: string,
  executor: SettingsMutationExecutor = db,
): Promise<void> {
  if (config.provider !== undefined) {
    await setSetting('llm.provider', config.provider, 'string', 'llm', 'LLM provider (google, openai, anthropic, custom)', false, userId, executor);
  }
  if (config.model !== undefined) {
    await setSetting('llm.model', config.model, 'string', 'llm', 'LLM model identifier', false, userId, executor);
  }
  if (config.apiKey !== undefined) {
    await setSetting('llm.api_key', config.apiKey, 'string', 'llm', 'LLM API key', true, userId, executor);
  }
  if (config.apiEndpoint !== undefined) {
    await setSetting('llm.api_endpoint', config.apiEndpoint, 'string', 'llm', 'Custom LLM API endpoint', false, userId, executor);
  }
  if (config.temperature !== undefined) {
    await setSetting('llm.temperature', config.temperature, 'number', 'llm', 'LLM temperature (0-1)', false, userId, executor);
  }
  if (config.maxTokens !== undefined) {
    await setSetting('llm.max_tokens', config.maxTokens, 'number', 'llm', 'Maximum tokens for LLM response', false, userId, executor);
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getLLMConfig, updateLLMConfig, clearSettingsCache, type LLMConfig } from '@/lib/settings-service';
import { db } from '@/db/client';
import { requireCapability } from '@/lib/admin-session';
import { recordAdminActivity } from '@/lib/admin-activity';
import { logServerEvent } from '@/lib/server-logger';
import { readJsonBody } from '@/lib/request-validation';
import { z } from 'zod';

const llmProviderSchema = z.enum(['google', 'openai', 'anthropic', 'zhipu', 'custom']);
const llmUpdateSchema = z.object({
  provider: llmProviderSchema.optional(),
  model: z.string().trim().min(1).max(500).optional(),
  apiKey: z.string().max(10_000).optional(),
  apiEndpoint: z.url().refine((value) => new URL(value).protocol === 'https:', {
    message: 'LLM endpoint must use HTTPS',
  }).optional(),
  apiProtocol: z.enum(['openai', 'anthropic']).optional(),
  temperature: z.number().finite().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(100_000).optional(),
}).strict();

function safeLLMConfig(config: LLMConfig) {
  const { apiKey: _apiKey, ...safeConfig } = config;
  return {
    ...safeConfig,
    hasApiKey: Boolean(config.apiKey),
  };
}

/**
 * GET /api/workspace/settings/llm
 * Get current LLM configuration
 */
export async function GET(_request: NextRequest) {
  const adminUser = await requireCapability('settings:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const config = await getLLMConfig();

    return NextResponse.json({ config: safeLLMConfig(config) });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.settings.llm.error', error: error });
    return NextResponse.json({ error: 'Failed to fetch LLM configuration' }, { status: 500 });
  }
}

/**
 * PUT /api/workspace/settings/llm
 * Update LLM configuration
 */
export async function PUT(request: NextRequest) {
  const adminUser = await requireCapability('settings:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const parsed = await readJsonBody(request, llmUpdateSchema);
    if (parsed.kind !== 'valid') {
      return NextResponse.json({ error: 'Invalid LLM configuration' }, { status: 400 });
    }

    const rawBody = parsed.data;
    const updates: Partial<LLMConfig> = {};
    if (rawBody.provider !== undefined) {
      updates.provider = rawBody.provider;
    }
    if (rawBody.model !== undefined) {
      updates.model = rawBody.model;
    }
    if (rawBody.apiKey !== undefined && rawBody.apiKey !== '') {
      updates.apiKey = rawBody.apiKey;
    }
    if (rawBody.apiEndpoint !== undefined) {
      updates.apiEndpoint = rawBody.apiEndpoint;
    }
    if (rawBody.apiProtocol !== undefined) {
      updates.apiProtocol = rawBody.apiProtocol;
    }
    if (rawBody.temperature !== undefined) {
      updates.temperature = rawBody.temperature;
    }
    if (rawBody.maxTokens !== undefined) {
      updates.maxTokens = rawBody.maxTokens;
    }

    const changedFields = Object.keys(updates).sort();
    await db.transaction(async (tx) => {
      await updateLLMConfig(updates, adminUser.id, tx);
      await recordAdminActivity(tx, {
        actorUserId: adminUser.id,
        action: 'settings.llm.updated',
        subjectType: 'settings',
        subjectId: 'llm',
        metadata: { changedFields },
      });
    });

    // Clear cache to ensure changes take effect immediately
    clearSettingsCache();

    return NextResponse.json({ 
      success: true, 
      message: 'LLM configuration updated successfully',
      config: safeLLMConfig(await getLLMConfig()),
    });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.settings.llm.error', error: error });
    return NextResponse.json({ error: 'Failed to update LLM configuration' }, { status: 500 });
  }
}

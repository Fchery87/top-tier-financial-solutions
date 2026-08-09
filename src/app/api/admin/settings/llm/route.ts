import { NextRequest, NextResponse } from 'next/server';
import { getLLMConfig, updateLLMConfig, clearSettingsCache, type LLMConfig } from '@/lib/settings-service';
import { db } from '@/db/client';
import { requireCapability } from '@/lib/admin-session';
import { recordAdminActivity } from '@/lib/admin-activity';
import { logServerEvent } from '@/lib/server-logger';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLLMProvider(value: unknown): value is LLMConfig['provider'] {
  return value === 'google' || value === 'openai' || value === 'anthropic' || value === 'zhipu' || value === 'custom';
}

/**
 * GET /api/admin/settings/llm
 * Get current LLM configuration
 */
export async function GET(_request: NextRequest) {
  const adminUser = await requireCapability('settings:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const config = await getLLMConfig();

    // Hide API key in response (show partial if exists)
    const response = {
      ...config,
      apiKey: config.apiKey 
        ? `${config.apiKey.substring(0, 8)}***${config.apiKey.substring(config.apiKey.length - 4)}`
        : undefined,
      hasApiKey: !!config.apiKey,
    };

    return NextResponse.json({ config: response });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.settings.llm.error', error: error });
    return NextResponse.json({ error: 'Failed to fetch LLM configuration' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/settings/llm
 * Update LLM configuration
 */
export async function PUT(request: NextRequest) {
  const adminUser = await requireCapability('settings:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const rawBody: unknown = await request.json();
    if (!isRecord(rawBody)) return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 });
    const updates: Partial<LLMConfig> = {};
    if (rawBody.provider !== undefined) {
      if (!isLLMProvider(rawBody.provider)) return NextResponse.json({ error: 'Invalid LLM provider' }, { status: 400 });
      updates.provider = rawBody.provider;
    }
    if (rawBody.model !== undefined) {
      if (typeof rawBody.model !== 'string') return NextResponse.json({ error: 'Invalid LLM model' }, { status: 400 });
      updates.model = rawBody.model;
    }
    if (rawBody.apiKey !== undefined && rawBody.apiKey !== '') {
      if (typeof rawBody.apiKey !== 'string') return NextResponse.json({ error: 'Invalid LLM API key' }, { status: 400 });
      updates.apiKey = rawBody.apiKey;
    }
    if (rawBody.apiEndpoint !== undefined) {
      if (typeof rawBody.apiEndpoint !== 'string') return NextResponse.json({ error: 'Invalid LLM endpoint' }, { status: 400 });
      updates.apiEndpoint = rawBody.apiEndpoint;
    }
    if (rawBody.temperature !== undefined) {
      if (typeof rawBody.temperature !== 'number') return NextResponse.json({ error: 'Invalid LLM temperature' }, { status: 400 });
      updates.temperature = rawBody.temperature;
    }
    if (rawBody.maxTokens !== undefined) {
      if (typeof rawBody.maxTokens !== 'number') return NextResponse.json({ error: 'Invalid LLM maximum tokens' }, { status: 400 });
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
      config: await getLLMConfig(),
    });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.settings.llm.error', error: error });
    return NextResponse.json({ error: 'Failed to update LLM configuration' }, { status: 500 });
  }
}


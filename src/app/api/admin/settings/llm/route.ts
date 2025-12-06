import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getLLMConfig, updateLLMConfig, clearSettingsCache, type LLMConfig } from '@/lib/settings-service';

// Check if user is super admin
async function checkSuperAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return { authorized: false, error: 'Unauthorized' };
  }

  const userRole = (session.user as { role?: string }).role;
  if (userRole !== 'super_admin') {
    return { authorized: false, error: 'Super admin access required' };
  }

  return { authorized: true, userId: session.user.id };
}

/**
 * GET /api/admin/settings/llm
 * Get current LLM configuration
 */
export async function GET(_request: NextRequest) {
  const authCheck = await checkSuperAdmin();
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: 403 });
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
    console.error('Error fetching LLM config:', error);
    return NextResponse.json({ error: 'Failed to fetch LLM configuration' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/settings/llm
 * Update LLM configuration
 */
export async function PUT(request: NextRequest) {
  const authCheck = await checkSuperAdmin();
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: 403 });
  }

  try {
    const body: Partial<LLMConfig> = await request.json();
    const { provider, model, apiKey, apiEndpoint, temperature, maxTokens } = body;

    const updates: Partial<LLMConfig> = {};
    if (provider !== undefined) updates.provider = provider;
    if (model !== undefined) updates.model = model;
    if (apiKey !== undefined && apiKey !== '') updates.apiKey = apiKey;
    if (apiEndpoint !== undefined) updates.apiEndpoint = apiEndpoint;
    if (temperature !== undefined) updates.temperature = temperature;
    if (maxTokens !== undefined) updates.maxTokens = maxTokens;

    await updateLLMConfig(updates, authCheck.userId);

    // Clear cache to ensure changes take effect immediately
    clearSettingsCache();

    return NextResponse.json({ 
      success: true, 
      message: 'LLM configuration updated successfully',
      config: await getLLMConfig(),
    });
  } catch (error) {
    console.error('Error updating LLM config:', error);
    return NextResponse.json({ error: 'Failed to update LLM configuration' }, { status: 500 });
  }
}



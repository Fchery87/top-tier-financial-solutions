import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getLLMConfig, type LLMConfig } from '@/lib/settings-service';
import { generateLetterDraft, LetterDraftError } from '@/lib/letter-rendering/provider-adapter';
import { logServerEvent } from '@/lib/server-logger';

const PROVIDER_LABELS: Record<LLMConfig['provider'], string> = {
  google: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic Claude',
  zhipu: 'Zhipu AI (GLM)',
  custom: 'Custom Provider',
};

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
 * POST /api/workspace/settings/llm/test
 * Test LLM connection with current configuration
 */
export async function POST(_request: NextRequest) {
  const authCheck = await checkSuperAdmin();
  if (!authCheck.authorized) {
    return NextResponse.json({ error: authCheck.error }, { status: 403 });
  }

  try {
    const config = await getLLMConfig();

    if (!config.apiKey) {
      return NextResponse.json({ 
        success: false, 
        error: 'No API key configured' 
      }, { status: 400 });
    }

    // Same code path as letter generation, so a passing test means letters
    // can be generated with this configuration (custom providers included).
    const text = await generateLetterDraft({
      prompt: 'Say "test successful" in exactly those two words.',
      config,
      responseFormat: 'text',
    });

    return NextResponse.json({
      success: true,
      message: 'Connection successful',
      provider: PROVIDER_LABELS[config.provider],
      model: config.model,
      endpoint: config.apiEndpoint,
      protocol: config.apiProtocol,
      response: text.substring(0, 100),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Connection test failed';
    if (error instanceof LetterDraftError && error.reason === 'configuration') {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    logServerEvent({ level: 'error', event: 'server.app.api.admin.settings.llm.test.error', error: error });
    return NextResponse.json({ 
      success: false, 
      error: message 
    }, { status: 500 });
  }
}

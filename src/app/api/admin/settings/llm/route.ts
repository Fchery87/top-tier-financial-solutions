import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getLLMConfig, updateLLMConfig, clearSettingsCache } from '@/lib/settings-service';

// Check if user is super admin
async function checkSuperAdmin() {
  const session = await auth();
  if (!session?.user) {
    return { authorized: false, error: 'Unauthorized' };
  }

  if (session.user.role !== 'super_admin') {
    return { authorized: false, error: 'Super admin access required' };
  }

  return { authorized: true, userId: session.user.id };
}

/**
 * GET /api/admin/settings/llm
 * Get current LLM configuration
 */
export async function GET(request: NextRequest) {
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
    const body = await request.json();
    const { provider, model, apiKey, apiEndpoint, temperature, maxTokens } = body;

    const updates: any = {};
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

/**
 * POST /api/admin/settings/llm/test
 * Test LLM connection with current configuration
 */
export async function POST(request: NextRequest) {
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

    // Test based on provider
    switch (config.provider) {
      case 'google': {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(config.apiKey);
        const model = genAI.getGenerativeModel({ model: config.model });
        const result = await model.generateContent('Say "test successful" if you receive this message.');
        const response = await result.response;
        const text = response.text();
        
        return NextResponse.json({ 
          success: true, 
          message: 'Connection successful',
          response: text.substring(0, 100),
        });
      }

      case 'openai': {
        // Add OpenAI test when implemented
        return NextResponse.json({ 
          success: false, 
          message: 'OpenAI provider testing not yet implemented' 
        });
      }

      case 'anthropic': {
        // Add Anthropic test when implemented
        return NextResponse.json({ 
          success: false, 
          message: 'Anthropic provider testing not yet implemented' 
        });
      }

      default:
        return NextResponse.json({ 
          success: false, 
          message: 'Unknown provider' 
        }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error testing LLM connection:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Connection test failed' 
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getLLMConfig } from '@/lib/settings-service';

// Check if user is super admin
async function checkSuperAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) {
    return { authorized: false, error: 'Unauthorized' };
  }

  if ((session.user as any).role !== 'super_admin') {
    return { authorized: false, error: 'Super admin access required' };
  }

  return { authorized: true, userId: session.user.id };
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

    const testPrompt = 'Say "test successful" in exactly those two words.';

    // Test based on provider
    switch (config.provider) {
      case 'google': {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(config.apiKey);
        const model = genAI.getGenerativeModel({ model: config.model });
        const result = await model.generateContent(testPrompt);
        const response = await result.response;
        const text = response.text();
        
        return NextResponse.json({ 
          success: true, 
          message: 'Connection successful',
          provider: 'Google Gemini',
          model: config.model,
          response: text.substring(0, 100),
        });
      }

      case 'openai': {
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({ apiKey: config.apiKey });
        const response = await openai.chat.completions.create({
          model: config.model || 'gpt-4o',
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 50,
        });
        const text = response.choices[0]?.message?.content || '';
        
        return NextResponse.json({ 
          success: true, 
          message: 'Connection successful',
          provider: 'OpenAI',
          model: config.model,
          response: text.substring(0, 100),
        });
      }

      case 'anthropic': {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const anthropic = new Anthropic({ apiKey: config.apiKey });
        const response = await anthropic.messages.create({
          model: config.model || 'claude-3-5-sonnet-20241022',
          max_tokens: 50,
          messages: [{ role: 'user', content: testPrompt }],
        });
        const textBlock = response.content.find(block => block.type === 'text');
        const text = textBlock?.type === 'text' ? textBlock.text : '';
        
        return NextResponse.json({ 
          success: true, 
          message: 'Connection successful',
          provider: 'Anthropic Claude',
          model: config.model,
          response: text.substring(0, 100),
        });
      }

      case 'zhipu': {
        const OpenAI = (await import('openai')).default;
        const client = new OpenAI({ 
          apiKey: config.apiKey,
          baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        });
        const response = await client.chat.completions.create({
          model: config.model || 'glm-4-flash',
          messages: [{ role: 'user', content: testPrompt }],
          max_tokens: 50,
        });
        const text = response.choices[0]?.message?.content || '';
        
        return NextResponse.json({ 
          success: true, 
          message: 'Connection successful',
          provider: 'Zhipu AI (GLM)',
          model: config.model,
          response: text.substring(0, 100),
        });
      }

      default:
        return NextResponse.json({ 
          success: false, 
          message: `Unknown provider: ${config.provider}` 
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

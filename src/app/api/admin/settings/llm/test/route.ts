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
        return NextResponse.json({ 
          success: false, 
          message: 'OpenAI provider testing not yet implemented' 
        });
      }

      case 'anthropic': {
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

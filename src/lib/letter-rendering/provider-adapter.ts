import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import {
  LETTER_PROVIDER_DEFAULT_MODELS,
  type LetterProviderConfig,
} from './types';

export interface GenerateLetterDraftInput {
  prompt: string;
  config: LetterProviderConfig;
}

function requireApiKey(config: LetterProviderConfig): string {
  if (!config.apiKey) {
    throw new Error('An API key is required to generate a provider draft');
  }
  return config.apiKey;
}

/**
 * Invokes an LLM with an already-completed prompt. The response is untrusted
 * draft text; policy, evidence, recipient, and persistence decisions remain
 * outside this adapter.
 */
export async function generateLetterDraft({ prompt, config }: GenerateLetterDraftInput): Promise<string> {
  const apiKey = requireApiKey(config);
  const temperature = config.temperature ?? 0.1;
  const maxTokens = config.maxTokens ?? 4096;

  switch (config.provider) {
    case 'google': {
      const genAI = new GoogleGenAI({ apiKey });
      const response = await genAI.models.generateContent({
        model: config.model || LETTER_PROVIDER_DEFAULT_MODELS.google,
        contents: prompt,
        config: {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
        },
      });
      return typeof response.text === 'string' ? response.text : '';
    }
    case 'openai': {
      const openai = new OpenAI({ apiKey });
      const response = await openai.chat.completions.create({
        model: config.model || LETTER_PROVIDER_DEFAULT_MODELS.openai,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      });
      return response.choices[0]?.message?.content || '';
    }
    case 'anthropic': {
      const anthropic = new Anthropic({ apiKey });
      const response = await anthropic.messages.create({
        model: config.model || LETTER_PROVIDER_DEFAULT_MODELS.anthropic,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });
      const textBlock = response.content.find((block) => block.type === 'text');
      return textBlock?.type === 'text' ? textBlock.text : '';
    }
    case 'zhipu': {
      const openai = new OpenAI({
        apiKey,
        baseURL: config.apiEndpoint || 'https://api.z.ai/api/paas/v4',
      });
      const response = await openai.chat.completions.create({
        model: config.model || LETTER_PROVIDER_DEFAULT_MODELS.zhipu,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
      });
      return response.choices[0]?.message?.content || '';
    }
    case 'custom':
      throw new Error('Custom LLM providers are not supported for letter generation');
  }
}

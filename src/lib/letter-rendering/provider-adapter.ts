import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import {
  LETTER_PROVIDER_DEFAULT_MODELS,
  type LetterProviderConfig,
  type LetterResponseFormat,
} from './types';

export interface GenerateLetterDraftInput {
  prompt: string;
  config: LetterProviderConfig;
  /** Required: each task states the format it needs. */
  responseFormat: LetterResponseFormat;
}

export type LetterDraftFailureReason = 'configuration' | 'truncated' | 'empty_response';

/** A provider call that did not yield a complete, usable draft. */
export class LetterDraftError extends Error {
  readonly reason: LetterDraftFailureReason;

  constructor(reason: LetterDraftFailureReason, message: string) {
    super(message);
    this.name = 'LetterDraftError';
    this.reason = reason;
  }
}

const DEFAULT_TEMPERATURE = 0.1;
const DEFAULT_MAX_TOKENS = 4096;

function requireApiKey(config: LetterProviderConfig): string {
  if (!config.apiKey) {
    throw new LetterDraftError('configuration', 'An API key is required to generate a provider draft');
  }
  return config.apiKey;
}

function requireText(text: string | null | undefined): string {
  if (!text || !text.trim()) {
    throw new LetterDraftError('empty_response', 'The provider returned no text');
  }
  return text;
}

function truncated(detail: string): LetterDraftError {
  return new LetterDraftError('truncated', `The provider stopped before finishing (${detail}); the draft is incomplete`);
}

interface ChatCompletionTarget {
  apiKey: string;
  baseURL?: string;
  model: string;
}

async function generateWithOpenAIProtocol(
  target: ChatCompletionTarget,
  prompt: string,
  responseFormat: LetterResponseFormat,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  const openai = new OpenAI(target.baseURL ? { apiKey: target.apiKey, baseURL: target.baseURL } : { apiKey: target.apiKey });
  const response = await openai.chat.completions.create({
    model: target.model,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: maxTokens,
    ...(responseFormat === 'json' ? { response_format: { type: 'json_object' as const } } : {}),
  });
  const choice = response.choices[0];
  if (choice?.finish_reason === 'length') throw truncated('finish_reason: length');
  return requireText(choice?.message?.content);
}

async function generateWithAnthropicProtocol(
  target: ChatCompletionTarget,
  prompt: string,
  temperature: number,
  maxTokens: number,
): Promise<string> {
  // JSON output is prompt-driven on this protocol. Streaming is used because
  // the SDK refuses non-streaming requests with large `max_tokens` budgets,
  // which reasoning models need for their thinking blocks.
  const anthropic = new Anthropic(target.baseURL ? { apiKey: target.apiKey, baseURL: target.baseURL } : { apiKey: target.apiKey });
  const message = await anthropic.messages.stream({
    model: target.model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'user', content: prompt }],
  }).finalMessage();
  if (message.stop_reason === 'max_tokens') throw truncated('stop_reason: max_tokens');
  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
  return requireText(text);
}

/**
 * Invokes an LLM with an already-completed prompt. The response is untrusted
 * draft text; policy, evidence, recipient, and persistence decisions remain
 * outside this adapter. Truncated or empty responses throw `LetterDraftError`.
 */
export async function generateLetterDraft({ prompt, config, responseFormat }: GenerateLetterDraftInput): Promise<string> {
  const temperature = config.temperature ?? DEFAULT_TEMPERATURE;
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;

  switch (config.provider) {
    case 'google': {
      const apiKey = requireApiKey(config);
      const genAI = new GoogleGenAI({ apiKey });
      const response = await genAI.models.generateContent({
        model: config.model || LETTER_PROVIDER_DEFAULT_MODELS.google,
        contents: prompt,
        config: {
          temperature,
          maxOutputTokens: maxTokens,
          ...(responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
        },
      });
      if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS') throw truncated('finishReason: MAX_TOKENS');
      return requireText(typeof response.text === 'string' ? response.text : '');
    }
    case 'openai':
      return generateWithOpenAIProtocol(
        { apiKey: requireApiKey(config), model: config.model || LETTER_PROVIDER_DEFAULT_MODELS.openai },
        prompt, responseFormat, temperature, maxTokens,
      );
    case 'anthropic':
      return generateWithAnthropicProtocol(
        { apiKey: requireApiKey(config), model: config.model || LETTER_PROVIDER_DEFAULT_MODELS.anthropic },
        prompt, temperature, maxTokens,
      );
    case 'zhipu':
      return generateWithOpenAIProtocol(
        {
          apiKey: requireApiKey(config),
          baseURL: config.apiEndpoint || 'https://api.z.ai/api/paas/v4',
          model: config.model || LETTER_PROVIDER_DEFAULT_MODELS.zhipu,
        },
        prompt, responseFormat, temperature, maxTokens,
      );
    case 'custom': {
      if (!config.apiEndpoint) {
        throw new LetterDraftError('configuration', 'Custom LLM provider requires an API endpoint (llm.api_endpoint)');
      }
      if (!config.model) {
        throw new LetterDraftError('configuration', 'Custom LLM provider requires a model (llm.model)');
      }
      const target = { apiKey: requireApiKey(config), baseURL: config.apiEndpoint, model: config.model };
      return config.apiProtocol === 'anthropic'
        ? generateWithAnthropicProtocol(target, prompt, temperature, maxTokens)
        : generateWithOpenAIProtocol(target, prompt, responseFormat, temperature, maxTokens);
    }
  }
}

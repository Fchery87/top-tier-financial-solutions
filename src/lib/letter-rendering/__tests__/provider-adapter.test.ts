import { beforeEach, describe, expect, it, vi } from 'vitest';

const createCompletion = vi.hoisted(() => vi.fn());
const openAiConstructor = vi.hoisted(() => vi.fn(function OpenAI() {
  return { chat: { completions: { create: createCompletion } } };
}));
const generateContent = vi.hoisted(() => vi.fn());
const googleConstructor = vi.hoisted(() => vi.fn(function GoogleGenAI() {
  return { models: { generateContent } };
}));
const finalMessage = vi.hoisted(() => vi.fn());
const streamMessages = vi.hoisted(() => vi.fn(() => ({ finalMessage })));
const anthropicConstructor = vi.hoisted(() => vi.fn(function Anthropic() {
  return { messages: { stream: streamMessages } };
}));

vi.mock('openai', () => ({ default: openAiConstructor }));
vi.mock('@google/genai', () => ({ GoogleGenAI: googleConstructor }));
vi.mock('@anthropic-ai/sdk', () => ({ default: anthropicConstructor }));

import { generateLetterDraft, LetterDraftError } from '@/lib/letter-rendering/provider-adapter';

const DEEPSEEK = {
  provider: 'custom' as const,
  model: 'deepseek-flash',
  apiKey: 'test-key',
  apiEndpoint: 'https://api.deepseek.com/anthropic',
  apiProtocol: 'anthropic' as const,
  temperature: 0.7,
  maxTokens: 384000,
};

function anthropicMessage(text: string, stopReason = 'end_turn') {
  return {
    stop_reason: stopReason,
    content: [
      { type: 'thinking', thinking: 'internal reasoning', signature: 'sig' },
      { type: 'text', text },
    ],
    usage: { input_tokens: 10, output_tokens: 20 },
  };
}

describe('generateLetterDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('google', () => {
    const config = { provider: 'google' as const, model: 'gemini-test', apiKey: 'test-key', temperature: 0.2, maxTokens: 600 };

    it('requests plain text for letter drafts', async () => {
      generateContent.mockResolvedValue({ text: 'Plain letter', candidates: [{ finishReason: 'STOP' }] });

      await expect(generateLetterDraft({ prompt: 'P', config, responseFormat: 'text' })).resolves.toBe('Plain letter');

      expect(googleConstructor).toHaveBeenCalledWith({ apiKey: 'test-key' });
      expect(generateContent).toHaveBeenCalledWith({
        model: 'gemini-test',
        contents: 'P',
        config: { temperature: 0.2, maxOutputTokens: 600 },
      });
    });

    it('requests JSON only when the task needs JSON', async () => {
      generateContent.mockResolvedValue({ text: '{"ok":true}', candidates: [{ finishReason: 'STOP' }] });

      await generateLetterDraft({ prompt: 'P', config, responseFormat: 'json' });

      expect(generateContent).toHaveBeenCalledWith({
        model: 'gemini-test',
        contents: 'P',
        config: { temperature: 0.2, maxOutputTokens: 600, responseMimeType: 'application/json' },
      });
    });

    it('fails a truncated response', async () => {
      generateContent.mockResolvedValue({ text: 'Cut of', candidates: [{ finishReason: 'MAX_TOKENS' }] });

      await expect(generateLetterDraft({ prompt: 'P', config, responseFormat: 'text' }))
        .rejects.toMatchObject({ name: 'LetterDraftError', reason: 'truncated' });
    });
  });

  describe('openai', () => {
    const config = { provider: 'openai' as const, model: 'gpt-test', apiKey: 'test-key', temperature: 0.2, maxTokens: 600 };

    it('requests plain text for letter drafts', async () => {
      createCompletion.mockResolvedValue({ choices: [{ message: { content: 'Plain letter' }, finish_reason: 'stop' }] });

      await expect(generateLetterDraft({ prompt: 'P', config, responseFormat: 'text' })).resolves.toBe('Plain letter');

      expect(openAiConstructor).toHaveBeenCalledWith({ apiKey: 'test-key' });
      expect(createCompletion).toHaveBeenCalledWith({
        model: 'gpt-test',
        messages: [{ role: 'user', content: 'P' }],
        temperature: 0.2,
        max_tokens: 600,
      });
    });

    it('requests a JSON object only when the task needs JSON', async () => {
      createCompletion.mockResolvedValue({ choices: [{ message: { content: '{}' }, finish_reason: 'stop' }] });

      await generateLetterDraft({ prompt: 'P', config, responseFormat: 'json' });

      expect(createCompletion).toHaveBeenCalledWith({
        model: 'gpt-test',
        messages: [{ role: 'user', content: 'P' }],
        temperature: 0.2,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      });
    });

    it('fails a response cut off by the token limit', async () => {
      createCompletion.mockResolvedValue({ choices: [{ message: { content: 'Cut of' }, finish_reason: 'length' }] });

      await expect(generateLetterDraft({ prompt: 'P', config, responseFormat: 'text' }))
        .rejects.toMatchObject({ name: 'LetterDraftError', reason: 'truncated' });
    });
  });

  describe('custom provider', () => {
    it('uses the Anthropic SDK with the endpoint as baseURL and the configured maxTokens', async () => {
      finalMessage.mockResolvedValue(anthropicMessage('Plain DeepSeek letter'));

      await expect(generateLetterDraft({ prompt: 'P', config: DEEPSEEK, responseFormat: 'text' }))
        .resolves.toBe('Plain DeepSeek letter');

      expect(anthropicConstructor).toHaveBeenCalledWith({ apiKey: 'test-key', baseURL: 'https://api.deepseek.com/anthropic' });
      expect(streamMessages).toHaveBeenCalledWith({
        model: 'deepseek-flash',
        max_tokens: 384000,
        temperature: 0.7,
        messages: [{ role: 'user', content: 'P' }],
      });
    });

    it('fails an Anthropic-protocol response that stopped at max_tokens', async () => {
      finalMessage.mockResolvedValue(anthropicMessage('Dear Experian, I am writ', 'max_tokens'));

      await expect(generateLetterDraft({ prompt: 'P', config: DEEPSEEK, responseFormat: 'text' }))
        .rejects.toMatchObject({ name: 'LetterDraftError', reason: 'truncated' });
    });

    it('fails a response with no text block', async () => {
      finalMessage.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'x', signature: 's' }] });

      await expect(generateLetterDraft({ prompt: 'P', config: DEEPSEEK, responseFormat: 'text' }))
        .rejects.toMatchObject({ name: 'LetterDraftError', reason: 'empty_response' });
    });

    it('uses the OpenAI SDK with the endpoint as baseURL and the same response-format rule', async () => {
      createCompletion.mockResolvedValue({ choices: [{ message: { content: '{}' }, finish_reason: 'stop' }] });
      const config = { ...DEEPSEEK, apiEndpoint: 'https://api.deepseek.com', apiProtocol: 'openai' as const, maxTokens: 8000 };

      await generateLetterDraft({ prompt: 'P', config, responseFormat: 'json' });
      await generateLetterDraft({ prompt: 'P', config, responseFormat: 'text' });

      expect(openAiConstructor).toHaveBeenCalledWith({ apiKey: 'test-key', baseURL: 'https://api.deepseek.com' });
      expect(createCompletion).toHaveBeenNthCalledWith(1, {
        model: 'deepseek-flash',
        messages: [{ role: 'user', content: 'P' }],
        temperature: 0.7,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
      });
      expect(createCompletion).toHaveBeenNthCalledWith(2, {
        model: 'deepseek-flash',
        messages: [{ role: 'user', content: 'P' }],
        temperature: 0.7,
        max_tokens: 8000,
      });
    });

    it('rejects a custom provider with no endpoint as a configuration error', async () => {
      await expect(generateLetterDraft({ prompt: 'P', config: { ...DEEPSEEK, apiEndpoint: undefined }, responseFormat: 'text' }))
        .rejects.toThrow('Custom LLM provider requires an API endpoint');
      expect(anthropicConstructor).not.toHaveBeenCalled();
      expect(openAiConstructor).not.toHaveBeenCalled();
    });

    it('rejects a custom provider with no model as a configuration error', async () => {
      await expect(generateLetterDraft({ prompt: 'P', config: { ...DEEPSEEK, model: '' }, responseFormat: 'text' }))
        .rejects.toThrow('Custom LLM provider requires a model');
      expect(anthropicConstructor).not.toHaveBeenCalled();
    });
  });

  it('exposes typed draft errors', () => {
    expect(new LetterDraftError('truncated', 'x').reason).toBe('truncated');
  });
});

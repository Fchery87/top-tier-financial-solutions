import { beforeEach, describe, expect, it, vi } from 'vitest';

const createCompletion = vi.hoisted(() => vi.fn());
const openAiConstructor = vi.hoisted(() => vi.fn(function OpenAI() {
  return {
  chat: { completions: { create: createCompletion } },
  };
}));

vi.mock('openai', () => ({ default: openAiConstructor }));

import { generateLetterDraft } from '@/lib/letter-rendering/provider-adapter';

describe('generateLetterDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards only the completed prompt and provider configuration to OpenAI', async () => {
    createCompletion.mockResolvedValue({
      choices: [{ message: { content: 'Untrusted provider draft' } }],
    });

    await expect(generateLetterDraft({
      prompt: 'Completed approved prompt',
      config: {
        provider: 'openai',
        model: 'gpt-test',
        apiKey: 'test-key',
        temperature: 0.2,
        maxTokens: 600,
      },
    })).resolves.toBe('Untrusted provider draft');

    expect(openAiConstructor).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(createCompletion).toHaveBeenCalledWith({
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'Completed approved prompt' }],
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });
  });
});

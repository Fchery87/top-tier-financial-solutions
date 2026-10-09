import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.hoisted(() => vi.fn());
const getLLMConfigMock = vi.hoisted(() => vi.fn());
const generateLetterDraftMock = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: getSessionMock } } }));
vi.mock('@/lib/settings-service', () => ({ getLLMConfig: getLLMConfigMock }));
vi.mock('@/lib/letter-rendering/provider-adapter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/letter-rendering/provider-adapter')>()),
  generateLetterDraft: generateLetterDraftMock,
}));

const DEEPSEEK = {
  provider: 'custom',
  model: 'deepseek-flash',
  apiKey: 'test-key',
  apiEndpoint: 'https://api.deepseek.com/anthropic',
  apiProtocol: 'anthropic',
  maxTokens: 384000,
};

describe('POST /api/workspace/settings/llm/test', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSessionMock.mockResolvedValue({ user: { id: 'admin-1', role: 'super_admin' } });
    getLLMConfigMock.mockResolvedValue(DEEPSEEK);
  });

  it('tests the connection through the same adapter as letter generation', async () => {
    generateLetterDraftMock.mockResolvedValue('test successful');
    const { POST } = await import('@/app/api/workspace/settings/llm/test/route');

    const response = await POST(new Request('http://localhost/api/workspace/settings/llm/test', { method: 'POST' }) as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      provider: 'Custom Provider',
      model: 'deepseek-flash',
      protocol: 'anthropic',
      response: 'test successful',
    });
    expect(generateLetterDraftMock).toHaveBeenCalledWith({ prompt: expect.any(String), config: DEEPSEEK, responseFormat: 'text' });
  });

  it('reports a configuration error as a 400', async () => {
    const { LetterDraftError } = await import('@/lib/letter-rendering/provider-adapter');
    generateLetterDraftMock.mockRejectedValue(new LetterDraftError('configuration', 'Custom LLM provider requires a model (llm.model)'));
    const { POST } = await import('@/app/api/workspace/settings/llm/test/route');

    const response = await POST(new Request('http://localhost/api/workspace/settings/llm/test', { method: 'POST' }) as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ success: false, error: 'Custom LLM provider requires a model (llm.model)' });
  });
});

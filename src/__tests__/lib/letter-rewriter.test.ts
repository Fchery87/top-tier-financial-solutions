import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateWithLLMMock = vi.hoisted(() => vi.fn());
const getLLMConfigMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/ai-letter-generator', () => ({
  generateWithLLM: generateWithLLMMock,
  safeParseJsonObject: <T>(raw: string): T | null => {
    try { return JSON.parse(raw) as T; } catch { return null; }
  },
}));

vi.mock('@/lib/settings-service', () => ({
  getLLMConfig: getLLMConfigMock,
}));

import { buildRewritePrompt, rewriteLetter } from '@/lib/letter-rewriter';

const lintContext = {
  reasonCodes: ['verification_required'],
  items: [{ creditorName: 'Example Creditor', accountNumber: '****4321', bureau: 'experian' }],
};

beforeEach(() => {
  vi.resetAllMocks();
  getLLMConfigMock.mockResolvedValue({ provider: 'openai', apiKey: 'test-key' });
});

describe('letter rewriter', () => {
  it('builds a distinct prompt for each tone', () => {
    const prompts = ['professional', 'concerned', 'annoyed', 'disappointed', 'demanding'].map(tone => buildRewritePrompt({
      currentLetter: 'Original letter',
      mode: 'tone',
      tone: tone as 'professional' | 'concerned' | 'annoyed' | 'disappointed' | 'demanding',
      lintContext,
    }));

    expect(new Set(prompts).size).toBe(5);
  });

  it('returns warning findings without retrying', async () => {
    generateWithLLMMock.mockResolvedValue(JSON.stringify({ letter: 'I will pursue legal action.' }));

    const result = await rewriteLetter({ currentLetter: 'Original', mode: 'rewrite', lintContext });

    expect(result.blocked).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.findings[0]?.code).toBe('threat_language');
    expect(generateWithLLMMock).toHaveBeenCalledOnce();
    expect(generateWithLLMMock).toHaveBeenCalledWith(expect.any(String), expect.anything(), 'json');
  });

  it('retries once when the model fabricates a creditor', async () => {
    generateWithLLMMock
      .mockResolvedValueOnce(JSON.stringify({ letter: 'Creditor Name: Fabricated Corp' }))
      .mockResolvedValueOnce(JSON.stringify({ letter: 'Creditor Name: Example Creditor' }));

    const result = await rewriteLetter({ currentLetter: 'Original', mode: 'rewrite', lintContext });

    expect(result.blocked).toBe(false);
    expect(result.attempts).toBe(2);
    expect(generateWithLLMMock).toHaveBeenCalledTimes(2);
  });

  it('returns blocked after two fabricated outputs', async () => {
    generateWithLLMMock.mockResolvedValue(JSON.stringify({ letter: 'Creditor Name: Fabricated Corp' }));

    const result = await rewriteLetter({ currentLetter: 'Original', mode: 'rewrite', lintContext });

    expect(result.blocked).toBe(true);
    expect(result.attempts).toBe(2);
    expect(generateWithLLMMock).toHaveBeenCalledTimes(2);
  });
});

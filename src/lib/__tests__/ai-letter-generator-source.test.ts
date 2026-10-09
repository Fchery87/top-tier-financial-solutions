import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLLMConfigMock = vi.hoisted(() => vi.fn());
const generateLetterDraftMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/settings-service', () => ({ getLLMConfig: getLLMConfigMock }));
vi.mock('@/lib/letter-rendering/provider-adapter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/letter-rendering/provider-adapter')>()),
  generateLetterDraft: generateLetterDraftMock,
}));

import { generateMultiItemDisputeLetter, generateUniqueDisputeLetter } from '@/lib/ai-letter-generator';
import { LetterDraftError } from '@/lib/letter-rendering/provider-adapter';

const CONFIG = {
  provider: 'custom',
  model: 'deepseek-flash',
  apiKey: 'test-key',
  apiEndpoint: 'https://api.deepseek.com/anthropic',
  apiProtocol: 'anthropic',
  maxTokens: 384000,
};

const AI_LETTER = [
  'I am writing to request a reasonable investigation of the account listed below under the Fair Credit Reporting Act.',
  '',
  'Creditor: Example Bank',
  '',
  'Please verify the reported information and correct or delete anything that cannot be verified.',
  '',
  'Sincerely,',
  'Jane Sample',
].join('\n');

const singleParams = {
  disputeType: 'standard',
  round: 1,
  targetRecipient: 'bureau' as const,
  clientData: { name: 'Jane Sample' },
  itemData: { creditorName: 'Example Bank', itemType: 'late_payment', bureau: 'experian' },
  reasonCodes: ['verification_required'],
};

const multiParams = {
  disputeType: 'standard',
  round: 1,
  targetRecipient: 'bureau' as const,
  clientData: { name: 'Jane Sample' },
  items: [{ creditorName: 'Example Bank', itemType: 'late_payment', bureau: 'experian' }],
  bureau: 'experian',
  reasonCodes: ['verification_required'],
};

describe('letter generation source', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getLLMConfigMock.mockResolvedValue(CONFIG);
  });

  it('reports an AI letter and asks the provider for plain text', async () => {
    generateLetterDraftMock.mockResolvedValue(AI_LETTER);

    const result = await generateUniqueDisputeLetter(singleParams);

    expect(result.source).toBe('ai');
    expect(result.failureReason).toBeUndefined();
    expect(result.letter).toContain('request a reasonable investigation');
    expect(generateLetterDraftMock).toHaveBeenCalledWith(expect.objectContaining({ responseFormat: 'text', config: CONFIG }));
  });

  it('records a truncated provider response as a template fallback', async () => {
    generateLetterDraftMock.mockRejectedValue(new LetterDraftError('truncated', 'stopped at max_tokens'));

    const result = await generateUniqueDisputeLetter(singleParams);

    expect(result).toMatchObject({ source: 'template_fallback', failureReason: 'truncated' });
    expect(result.letter.length).toBeGreaterThan(0);
  });

  it('records a provider exception as a template fallback', async () => {
    generateLetterDraftMock.mockRejectedValue(new Error('Custom LLM providers are not supported'));

    const result = await generateMultiItemDisputeLetter(multiParams);

    expect(result).toMatchObject({ source: 'template_fallback', failureReason: 'provider_error' });
    expect(result.letter.length).toBeGreaterThan(0);
  });

  it('records a missing API key as a template fallback without calling the provider', async () => {
    getLLMConfigMock.mockResolvedValue({ ...CONFIG, apiKey: undefined });

    const result = await generateMultiItemDisputeLetter(multiParams);

    expect(result).toMatchObject({ source: 'template_fallback', failureReason: 'missing_api_key' });
    expect(generateLetterDraftMock).not.toHaveBeenCalled();
  });
});

describe('letterGenerationNotice', () => {
  it('explains a template fallback and stays silent for AI letters', async () => {
    const { letterGenerationNotice } = await import('@/lib/letter-generation-notice');
    expect(letterGenerationNotice('template_fallback', 'truncated')).toBe(
      'AI generation failed (the AI response was cut off); a template letter was used. Review it before sending.',
    );
    expect(letterGenerationNotice('ai', null)).toBeNull();
    expect(letterGenerationNotice('manual', null)).toBeNull();
  });
});

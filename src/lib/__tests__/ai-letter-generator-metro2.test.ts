import { describe, expect, it, vi } from 'vitest';

const getLLMConfigMock = vi.hoisted(() => vi.fn());
const generateLetterDraftMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/settings-service', () => ({
  getLLMConfig: getLLMConfigMock,
}));

vi.mock('@/lib/letter-rendering/provider-adapter', () => ({
  generateLetterDraft: generateLetterDraftMock,
}));

import { generateFactualMetro2DisputeLetter } from '@/lib/ai-letter-generator';

describe('generateFactualMetro2DisputeLetter', () => {
  it('routes Google-backed factual analysis through the provider adapter', async () => {
    getLLMConfigMock.mockResolvedValue({
      provider: 'google',
      model: 'gemini-test',
      apiKey: 'test-key',
      temperature: 0.2,
      maxTokens: 600,
    });
    generateLetterDraftMock.mockResolvedValue(JSON.stringify({
      analysis_summary: [{
        item_id: 'item-1',
        issue_found: true,
        issue_types: ['wrong_balance'],
        explanation: 'The balance conflicts with the account status.',
      }],
      dispute_letter: 'Please investigate the reported balance.',
    }));

    const result = await generateFactualMetro2DisputeLetter({
      consumerName: 'Ada Lovelace',
      recipientType: 'bureau',
      recipientName: 'Experian',
      bureau: 'experian',
      round: 1,
      negativeItems: [{
        itemId: 'item-1',
        bureauName: 'Experian',
        furnisherName: 'Example Furnisher',
        accountType: 'revolving',
        accountStatusCode: '30',
      }],
    });

    expect(generateLetterDraftMock).toHaveBeenCalledWith({
      prompt: expect.stringContaining('ANALYSIS CHECKLIST'),
      config: {
        provider: 'google',
        model: 'gemini-test',
        apiKey: 'test-key',
        temperature: 0.2,
        maxTokens: 600,
      },
    });
    expect(result).toMatchObject({
      itemsWithIssues: 1,
      totalItems: 1,
    });
    expect(result.disputeLetter).toContain('Please investigate the reported balance.');
  });
});

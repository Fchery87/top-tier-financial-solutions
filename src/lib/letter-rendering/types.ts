export type LetterProvider = 'google' | 'openai' | 'anthropic' | 'zhipu' | 'custom';

export interface LetterProviderConfig {
  provider: LetterProvider;
  model: string;
  apiKey?: string;
  apiEndpoint?: string;
  temperature?: number;
  maxTokens?: number;
}

export const LETTER_PROVIDER_DEFAULT_MODELS = {
  google: 'gemini-2.5-flash',
  openai: 'gpt-5',
  anthropic: 'claude-sonnet-5',
  zhipu: 'glm-4-flash',
  custom: 'gemini-2.5-flash',
} as const;

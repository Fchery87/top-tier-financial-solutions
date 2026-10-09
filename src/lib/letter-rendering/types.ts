export type LetterProvider = 'google' | 'openai' | 'anthropic' | 'zhipu' | 'custom';

/** Wire protocol spoken by a custom provider's endpoint. */
export type LetterProviderProtocol = 'openai' | 'anthropic';

/** What a task needs back: letter drafts are plain text, analysis and rewrites are JSON. */
export type LetterResponseFormat = 'text' | 'json';

export interface LetterProviderConfig {
  provider: LetterProvider;
  model: string;
  apiKey?: string;
  apiEndpoint?: string;
  /** Set for custom providers by `getLLMConfig`. */
  apiProtocol?: LetterProviderProtocol;
  temperature?: number;
  maxTokens?: number;
}

/** Default models for first-party providers. Custom providers have none. */
export const LETTER_PROVIDER_DEFAULT_MODELS = {
  google: 'gemini-2.5-flash',
  openai: 'gpt-5',
  anthropic: 'claude-sonnet-5',
  zhipu: 'glm-4-flash',
} as const;

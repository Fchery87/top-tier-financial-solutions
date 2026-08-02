import { generateWithLLM, safeParseJsonObject } from '@/lib/ai-letter-generator';
import { lintGeneratedLetter, type LetterLintContext, type LetterLintFinding } from '@/lib/letter-lint';
import { getLLMConfig } from '@/lib/settings-service';

export type RewriteMode = 'rewrite' | 'tone' | 'custom';
export type LetterTone = 'professional' | 'concerned' | 'annoyed' | 'disappointed' | 'demanding';

export interface RewriteParams {
  currentLetter: string;
  mode: RewriteMode;
  tone?: LetterTone;
  instruction?: string;
  lintContext: LetterLintContext;
}

export interface RewriteResult {
  letter: string;
  blocked: boolean;
  findings: LetterLintFinding[];
  attempts: number;
}

const TONE_GUIDANCE: Record<LetterTone, string> = {
  professional: 'measured, businesslike, and precise',
  concerned: 'a consumer worried about the impact of inaccurate reporting',
  annoyed: 'a consumer frustrated that the same issue has required repeated explanation',
  disappointed: 'a consumer let down after a prior dispute did not resolve the issue',
  demanding: 'a consumer who is firm and insistent on a factual remedy without making legal threats',
};

export function buildRewritePrompt(params: RewriteParams): string {
  const instruction = params.mode === 'tone'
    ? `Shift the consumer voice to sound ${TONE_GUIDANCE[params.tone || 'professional']}.`
    : params.mode === 'custom'
      ? `Apply this staff instruction while preserving supported facts: ${params.instruction || 'Improve clarity and specificity.'}`
      : 'Rewrite the letter in fresh language while preserving its supported substance.';

  return `Rewrite the following credit dispute letter and return only a JSON object with a single "letter" string.

RULES
- Use only creditor names, account numbers, and bureau names present in the source data.
- Do not assert identity theft or fraud unless the provided lint context supports it.
- Preserve the factual substance and requested remedy.
- Do not add legal threats, damages, or unsupported statutory claims.
- ${instruction}

CURRENT LETTER
${params.currentLetter}`;
}

export async function rewriteLetter(params: RewriteParams): Promise<RewriteResult> {
  const config = await getLLMConfig();
  if (!config.apiKey) {
    return {
      letter: params.currentLetter,
      blocked: false,
      findings: [],
      attempts: 0,
    };
  }

  let lastLetter = params.currentLetter;
  let lastFindings: LetterLintFinding[] = [];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const raw = await generateWithLLM(buildRewritePrompt(params), config);
    const parsed = safeParseJsonObject<{ letter?: unknown }>(raw);
    if (!parsed || typeof parsed.letter !== 'string' || !parsed.letter.trim()) {
      lastFindings = [{ code: 'invalid_model_output', severity: 'block', message: 'The model did not return a usable letter.' }];
      continue;
    }

    lastLetter = parsed.letter.trim();
    const lint = lintGeneratedLetter(lastLetter, params.lintContext);
    lastFindings = lint.findings;
    if (!lint.blocked) {
      return { letter: lastLetter, blocked: false, findings: lint.findings, attempts: attempt };
    }
  }

  return { letter: lastLetter, blocked: true, findings: lastFindings, attempts: 2 };
}

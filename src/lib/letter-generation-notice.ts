/**
 * Staff-facing notice for a generation response. Returns null when the letter
 * is the AI draft (or was written manually).
 */
export function letterGenerationNotice(source: unknown, failureReason: unknown): string | null {
  if (source !== 'template_fallback') return null;
  const reason = typeof failureReason === 'string' ? FAILURE_REASON_LABELS[failureReason] : undefined;
  return `AI generation failed${reason ? ` (${reason})` : ''}; a template letter was used. Review it before sending.`;
}

const FAILURE_REASON_LABELS: Record<string, string> = {
  missing_api_key: 'no API key is configured',
  configuration: 'the AI provider is misconfigured',
  truncated: 'the AI response was cut off',
  empty_response: 'the AI returned no text',
  provider_error: 'the AI provider returned an error',
  lint_failed: 'the AI draft failed compliance checks',
};

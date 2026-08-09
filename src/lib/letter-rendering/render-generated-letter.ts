export interface GeneratedLetterRenderInput {
  draftText: string;
  renderedOn: string;
  recipientAddress?: string;
}

const writtenDatePattern = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/;

/**
 * Applies deterministic delivery formatting to untrusted provider text.
 * It never adds claims, citations, or policy decisions.
 */
export function renderGeneratedLetter(input: GeneratedLetterRenderInput): string {
  let renderedLetter = input.draftText;

  if (
    !renderedLetter.includes(input.renderedOn)
    && !writtenDatePattern.test(renderedLetter)
  ) {
    renderedLetter = `${input.renderedOn}\n\n${renderedLetter}`;
  }

  const recipientFirstLine = input.recipientAddress?.split('\n')[0]?.trim();
  if (recipientFirstLine && !renderedLetter.includes(recipientFirstLine)) {
    const dateMatch = renderedLetter.match(/^.*?\d{4}/);
    if (dateMatch) {
      renderedLetter = renderedLetter.replace(
        dateMatch[0],
        `${dateMatch[0]}\n\n${input.recipientAddress}`,
      );
    }
  }

  return renderedLetter.trim();
}

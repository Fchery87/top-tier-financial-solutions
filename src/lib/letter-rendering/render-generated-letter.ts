import { formatDateOfBirth } from './letter-dates';
import type { LetterConsumerIdentity } from './types';

export interface GeneratedLetterRenderInput {
  /** Untrusted provider text, or a template body. Starts at the subject or salutation. */
  draftText: string;
  consumer: LetterConsumerIdentity;
  /** The letter date, from `formatLetterDate`. */
  renderedOn: string;
  recipientAddress: string;
}

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December';
const WRITTEN_DATE = new RegExp(`^(${MONTHS})\\s+\\d{1,2},\\s+\\d{4}$`);
const NUMERIC_DATE = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
const BODY_START = /^(re|subject)\s*:|^(to whom it may concern|dear\b)/i;
const CLOSING = /^(sincerely|respectfully|respectfully yours|respectfully submitted|regards|best regards|kind regards|thank you|yours truly),?$/i;
const PLACEHOLDER = /^\[[^\]\n]{1,60}\]$/;
/** How far into a draft a sender/recipient header can reach. */
const HEADER_SEARCH_LINES = 30;

function normalize(line: string): string {
  return line.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** The consumer block that opens every letter. */
export function formatConsumerHeader(consumer: LetterConsumerIdentity): string {
  const lines = [
    consumer.fullName,
    consumer.streetAddress,
    `${consumer.city}, ${consumer.state} ${consumer.zip}`,
  ];
  if (consumer.dateOfBirth) lines.push(`Date of Birth: ${formatDateOfBirth(consumer.dateOfBirth)}`);
  if (consumer.ssnLast4) lines.push(`SSN (last 4): XXX-XX-${consumer.ssnLast4}`);
  return lines.join('\n');
}

/** A short line that is not a sentence: a name, an address line, a date or a placeholder. */
function isHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (trimmed.length > 80) return false;
  const isSentence = /[.!?]$/.test(trimmed) && trimmed.split(/\s+/).length >= 5;
  return !isSentence;
}

/**
 * Drops the sender, date and recipient lines a provider writes despite being
 * told not to. Conservative: a header is removed only when every line before
 * the subject or salutation is a short non-sentence line; otherwise only
 * leading lines that exactly repeat what code renders are removed.
 */
function stripLeadingHeader(lines: string[], knownHeaderLines: Set<string>): string[] {
  const searchEnd = Math.min(lines.length, HEADER_SEARCH_LINES);
  const bodyStart = lines.slice(0, searchEnd).findIndex((line) => BODY_START.test(line.trim()));
  if (bodyStart >= 0 && lines.slice(0, bodyStart).every(isHeaderLine)) {
    return lines.slice(bodyStart);
  }

  let start = 0;
  while (start < lines.length) {
    const trimmed = lines[start].trim();
    const repeatsHeader = !trimmed
      || PLACEHOLDER.test(trimmed)
      || WRITTEN_DATE.test(trimmed)
      || NUMERIC_DATE.test(trimmed)
      || knownHeaderLines.has(normalize(trimmed));
    if (!repeatsHeader) break;
    start += 1;
  }
  return lines.slice(start);
}

/** Ensures the letter is signed with the consumer's decrypted name. */
function signWithConsumerName(lines: string[], fullName: string): string[] {
  let closing = -1;
  lines.forEach((line, index) => {
    if (CLOSING.test(line.trim())) closing = index;
  });
  if (closing === -1) return [...lines, '', 'Sincerely,', '', fullName];

  const signed = [...lines];
  const nameLine = signed.findIndex((line, index) => index > closing && line.trim() !== '');
  if (nameLine === -1) return [...signed.slice(0, closing + 1), '', fullName];
  if (normalize(signed[nameLine]) === normalize(fullName)) return signed;
  if (PLACEHOLDER.test(signed[nameLine].trim())) {
    signed[nameLine] = fullName;
    return signed;
  }
  signed.splice(closing + 1, 0, '', fullName);
  return signed;
}

/**
 * Assembles the delivered letter: consumer header, letter date, recipient,
 * then the body. The header is rendered by code from decrypted data and never
 * comes from the provider. It never adds claims, citations, or policy decisions.
 */
export function renderGeneratedLetter(input: GeneratedLetterRenderInput): string {
  const consumerHeader = formatConsumerHeader(input.consumer);
  const knownHeaderLines = new Set(
    [...consumerHeader.split('\n'), input.renderedOn, ...input.recipientAddress.split('\n')].map(normalize),
  );

  const draftLines = input.draftText.replace(/\r\n/g, '\n').trim().split('\n');
  const bodyLines = signWithConsumerName(stripLeadingHeader(draftLines, knownHeaderLines), input.consumer.fullName)
    .filter((line) => !PLACEHOLDER.test(line.trim()));
  const body = bodyLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return `${consumerHeader}\n\n${input.renderedOn}\n\n${input.recipientAddress.trim()}\n\n${body}`;
}

/**
 * Splits a letter produced by `renderGeneratedLetter` into its code-rendered
 * header (consumer, date, recipient) and its body, so the header can be kept
 * away from a provider. Returns null for a letter without that header.
 */
export function splitRenderedLetter(letter: string): { header: string; body: string } | null {
  const paragraphs = letter.split('\n\n');
  if (paragraphs.length < 4) return null;
  const [consumerBlock, dateLine, recipientBlock] = paragraphs;
  if (consumerBlock.split('\n').length < 3 || !WRITTEN_DATE.test(dateLine.trim()) || !recipientBlock.trim()) {
    return null;
  }
  return {
    header: paragraphs.slice(0, 3).join('\n\n'),
    body: paragraphs.slice(3).join('\n\n'),
  };
}

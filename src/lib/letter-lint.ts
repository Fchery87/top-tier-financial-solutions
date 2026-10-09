import { OWNERSHIP_CLAIM_TYPES } from '@/lib/high-risk-claim-registry';

export interface LetterLintItemContext {
  creditorName?: string;
  originalCreditor?: string;
  accountNumber?: string;
  amount?: number;
  bureau?: string;
}

export interface LetterLintContext {
  reasonCodes: string[];
  items: LetterLintItemContext[];
  identityTheftFlag?: boolean;
}

export type LintSeverity = 'block' | 'warn';

export interface LetterLintFinding {
  code: string;
  severity: LintSeverity;
  message: string;
}

export interface LetterLintResult {
  blocked: boolean;
  findings: LetterLintFinding[];
  /** @deprecated Use `blocked` instead. */
  passed: boolean;
  /** @deprecated Use `findings` instead. */
  reasons: string[];
}

const OWNERSHIP_DENIAL_PATTERN = /\b(not mine|not my account|does not belong to me|never opened|never authorized|fraudulent account|unauthorized account)\b/i;
const IDENTITY_THEFT_PATTERN = /\b(identity theft|identity fraud|fraudulent account)\b/i;
const THREAT_LANGUAGE_PATTERN = /\b(statutory damages|punitive damages|legal action|lawsuit|sue|willful non-compliance)\b/i;
const ACCOUNT_NUMBER_PATTERN = /\*{2,}\d{4}/g;
const CREDITOR_LINE_PATTERN = /^Creditor Name:\s*(.+)$/gim;
const ORIGINAL_CREDITOR_LINE_PATTERN = /^Original Creditor:\s*(.+)$/gim;
const STATUTE_PATTERNS = [
  /15\s+U\.S\.C\.\s*§+\s*([\dA-Za-z\-]+(?:\([a-z0-9]+\))*)/gi,
  /FCRA\s*(?:Section|§)\s*([\dA-Za-z\-]+(?:\([a-z0-9]+\))*)/gi,
  /FDCPA\s*(?:Section|§)?\s*([\dA-Za-z\-]+(?:\([a-z0-9]+\))*)/gi,
];

const ALLOWED_STATUTE_TOKENS = new Set([
  '1681i',
  '1681g',
  '1681c',
  '1681c-2',
  '1681b',
  '1681e',
  '1681e(b)',
  '1681n',
  '1681o',
  '1681s-2',
  '1681s-2(a)(8)',
  '611',
  '611(a)(1)',
  '611(a)(6)(b)(iii)',
  '611(a)(7)',
  '607',
  '607(b)',
  '605',
  '605(a)',
  '609',
  '623',
  '623(a)(2)',
  '623(a)(8)',
  '604',
  '1692e',
  '1692f',
  '1692g',
  '809',
  '809(b)',
]);

function normalizeToken(token: string): string {
  return token.replace(/\s+/g, '').toLowerCase();
}

function extractMatches(pattern: RegExp, text: string): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match[1]) {
      matches.push(match[1]);
    }
  }
  return matches;
}

export function lintGeneratedLetter(letter: string, context: LetterLintContext): LetterLintResult {
  const findings: LetterLintFinding[] = [];
  const normalizedReasonCodes = new Set(context.reasonCodes);

  if (OWNERSHIP_DENIAL_PATTERN.test(letter)) {
    const allowed = OWNERSHIP_CLAIM_TYPES.some(code => normalizedReasonCodes.has(code));
    if (!allowed) {
      findings.push({
        code: 'ownership_denial',
        severity: 'warn',
        message: 'Letter includes ownership-denial language without an approved ownership-related reason code.',
      });
    }
  }

  if (IDENTITY_THEFT_PATTERN.test(letter) && !context.identityTheftFlag && !normalizedReasonCodes.has('identity_theft') && !normalizedReasonCodes.has('fraud')) {
    findings.push({
      code: 'undocumented_identity_theft',
      severity: 'block',
      message: 'Letter references identity theft or fraud without a documented identity-theft flag.',
    });
  }

  if (THREAT_LANGUAGE_PATTERN.test(letter)) {
    findings.push({
      code: 'threat_language',
      severity: 'warn',
      message: 'Letter includes threat or damages language. Review whether that language is appropriate for this dispute.',
    });
  }

  const citedTokens = STATUTE_PATTERNS.flatMap(pattern => extractMatches(pattern, letter));
  const invalidTokens = citedTokens.filter(token => !ALLOWED_STATUTE_TOKENS.has(normalizeToken(token)));
  if (invalidTokens.length > 0) {
    findings.push({
      code: 'statute_not_allowlisted',
      severity: 'warn',
      message: `Letter cites statutes outside the allowlist: ${[...new Set(invalidTokens)].join(', ')}`,
    });
  }

  const allowedAccountNumbers = new Set(
    context.items
      .map(item => item.accountNumber?.match(/(\d{4})$/)?.[1])
      .filter((value): value is string => Boolean(value))
      .map(last4 => `****${last4}`)
  );
  const mentionedAccountNumbers = letter.match(ACCOUNT_NUMBER_PATTERN) || [];
  const unexpectedAccountNumbers = mentionedAccountNumbers.filter(
    value => allowedAccountNumbers.size > 0 && !allowedAccountNumbers.has(value)
  );
  if (unexpectedAccountNumbers.length > 0) {
    findings.push({
      code: 'unknown_account_number',
      severity: 'block',
      message: `Letter references account numbers that do not match the source data: ${[...new Set(unexpectedAccountNumbers)].join(', ')}`,
    });
  }

  const allowedCreditorNames = new Set(
    context.items
      .flatMap(item => [item.creditorName, item.originalCreditor])
      .filter((value): value is string => Boolean(value))
      .map(value => value.trim().toLowerCase())
  );
  const mentionedCreditorNames = [
    ...extractMatches(CREDITOR_LINE_PATTERN, letter),
    ...extractMatches(ORIGINAL_CREDITOR_LINE_PATTERN, letter),
  ].map(value => value.trim().toLowerCase());
  const unexpectedCreditorNames = mentionedCreditorNames.filter(
    value => allowedCreditorNames.size > 0 && !allowedCreditorNames.has(value)
  );
  if (unexpectedCreditorNames.length > 0) {
    findings.push({
      code: 'unknown_creditor',
      severity: 'block',
      message: `Letter references creditor details that do not match the source data: ${[...new Set(unexpectedCreditorNames)].join(', ')}`,
    });
  }

  const blocked = findings.some(finding => finding.severity === 'block');
  return {
    blocked,
    findings,
    passed: !blocked,
    reasons: findings.map(finding => finding.message),
  };
}

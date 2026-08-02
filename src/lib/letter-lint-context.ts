import type { LetterLintContext } from '@/lib/letter-lint';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseSnapshot(value: string | null | undefined): LetterLintContext | null {
  if (!value) return null;

  try {
    const candidate: unknown = JSON.parse(value);
    if (!isRecord(candidate) || !Array.isArray(candidate.reasonCodes) || !Array.isArray(candidate.items)) return null;
    if (!candidate.reasonCodes.every((code): code is string => typeof code === 'string')) return null;

    const items = candidate.items.filter(isRecord).filter((item) => {
      const values = [item.creditorName, item.originalCreditor, item.accountNumber, item.bureau];
      return values.every((itemValue) => itemValue === undefined || itemValue === null || typeof itemValue === 'string')
        && (item.amount === undefined || item.amount === null || typeof item.amount === 'number');
    }).map((item) => ({
      creditorName: typeof item.creditorName === 'string' ? item.creditorName : undefined,
      originalCreditor: typeof item.originalCreditor === 'string' ? item.originalCreditor : undefined,
      accountNumber: typeof item.accountNumber === 'string' ? item.accountNumber : undefined,
      bureau: typeof item.bureau === 'string' ? item.bureau : undefined,
      amount: typeof item.amount === 'number' ? item.amount : undefined,
    }));

    if (items.length !== candidate.items.length) return null;
    if (candidate.identityTheftFlag !== undefined && typeof candidate.identityTheftFlag !== 'boolean') return null;

    return {
      reasonCodes: candidate.reasonCodes,
      items,
      identityTheftFlag: candidate.identityTheftFlag === true,
    };
  } catch {
    return null;
  }
}

export function buildLetterLintContextForDispute(input: {
  reasonCodes: string[];
  creditorName?: string | null;
  originalCreditor?: string | null;
  accountNumber?: string | null;
  bureau?: string | null;
  identityTheftFlag?: boolean;
  letterContextSnapshot?: string | null;
}): LetterLintContext {
  const snapshot = parseSnapshot(input.letterContextSnapshot);
  if (snapshot) return snapshot;

  return {
    reasonCodes: input.reasonCodes,
    items: [{
      creditorName: input.creditorName || undefined,
      originalCreditor: input.originalCreditor || undefined,
      accountNumber: input.accountNumber || undefined,
      bureau: input.bureau || undefined,
    }],
    identityTheftFlag: input.identityTheftFlag ?? input.reasonCodes.includes('identity_theft'),
  };
}

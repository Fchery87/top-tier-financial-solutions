export type LetterDiffKind = 'same' | 'added' | 'removed';

export interface LetterDiffLine {
  kind: LetterDiffKind;
  text: string;
}

export function buildLetterDiff(before: string, after: string): LetterDiffLine[] {
  const left = before.split('\n');
  const right = after.split('\n');
  const rows: LetterDiffLine[] = [];
  const max = Math.max(left.length, right.length);

  for (let index = 0; index < max; index += 1) {
    const previous = left[index];
    const next = right[index];
    if (previous === next && previous !== undefined) {
      rows.push({ kind: 'same', text: previous });
    } else {
      if (previous !== undefined) rows.push({ kind: 'removed', text: previous });
      if (next !== undefined) rows.push({ kind: 'added', text: next });
    }
  }

  return rows;
}

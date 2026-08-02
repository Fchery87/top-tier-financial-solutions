import { describe, expect, it } from 'vitest';
import { buildLetterDiff } from '@/lib/letter-diff';

describe('buildLetterDiff', () => {
  it('marks added and removed lines while preserving unchanged lines', () => {
    expect(buildLetterDiff('A\nB', 'A\nC')).toEqual([
      { kind: 'same', text: 'A' },
      { kind: 'removed', text: 'B' },
      { kind: 'added', text: 'C' },
    ]);
  });
});

'use client';

import { buildLetterDiff } from '@/lib/letter-diff';

interface LetterDiffViewProps {
  before: string;
  after: string;
}

export function LetterDiffView({ before, after }: LetterDiffViewProps) {
  return (
    <div className="max-h-56 overflow-auto rounded-md border border-border bg-muted/20 p-2 font-mono text-[11px] leading-5">
      {buildLetterDiff(before, after).map((line, index) => (
        <div key={`${line.kind}-${index}`} className={line.kind === 'added' ? 'bg-success/10 text-success' : line.kind === 'removed' ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground'}>
          <span className="mr-2 inline-block w-3 text-center">{line.kind === 'added' ? '+' : line.kind === 'removed' ? '−' : ' '}</span>{line.text || ' '}
        </div>
      ))}
    </div>
  );
}

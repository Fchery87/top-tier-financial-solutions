'use client';

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface LetterRevisionSummary {
  id: string;
  revision: number;
  source: string;
  toneLabel: string | null;
  warningsAcknowledged: boolean;
  createdBy: string | null;
  createdAt: string | null;
  content: string;
}

interface LetterRevisionHistoryProps {
  revisions: LetterRevisionSummary[];
  selectedRevisionId: string | null;
  immutable: boolean;
  onSelect: (revision: LetterRevisionSummary) => void;
  onRevert: (revision: LetterRevisionSummary) => void;
}

export function LetterRevisionHistory({ revisions, selectedRevisionId, immutable, onSelect, onRevert }: LetterRevisionHistoryProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Revision history</h4>
      {revisions.length === 0 && <p className="text-xs text-muted-foreground">No saved revisions yet.</p>}
      {revisions.map(revision => (
        <div key={revision.id} className={`flex items-center justify-between gap-2 rounded-md border p-2 text-xs ${selectedRevisionId === revision.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(revision)}>
            <span className="font-medium">Revision {revision.revision} · {revision.source.replace('_', ' ')}</span>
            <span className="block text-muted-foreground">{revision.toneLabel || 'default'} · {revision.createdAt ? new Date(revision.createdAt).toLocaleString() : 'unknown date'}{revision.warningsAcknowledged ? ' · acknowledged' : ''}</span>
          </button>
          {!immutable && <Button type="button" variant="ghost" size="sm" aria-label={`Revert to revision ${revision.revision}`} onClick={() => onRevert(revision)}><RotateCcw className="h-3.5 w-3.5" /></Button>}
        </div>
      ))}
    </div>
  );
}

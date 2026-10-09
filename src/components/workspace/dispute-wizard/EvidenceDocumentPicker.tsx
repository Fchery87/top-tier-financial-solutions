'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EvidenceDocument } from './types';

interface EvidenceDocumentPickerProps {
  documents: EvidenceDocument[];
  selectedIds: string[];
  onToggle: (documentId: string) => void;
  className?: string;
}

/** The client's uploaded documents as a pick list. */
export function EvidenceDocumentPicker({ documents, selectedIds, onToggle, className }: EvidenceDocumentPickerProps) {
  return (
    <div className={cn('space-y-2 max-h-[200px] overflow-y-auto', className)}>
      {documents.map((doc) => {
        const isSelected = selectedIds.includes(doc.id);
        return (
          <div
            key={doc.id}
            aria-pressed={isSelected}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'border-secondary bg-secondary/10' : 'border-border hover:border-secondary/50'}`}
            onClick={() => onToggle(doc.id)}
          >
            <div className="flex items-center gap-3">
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSelected ? 'border-secondary bg-secondary' : 'border-muted-foreground/30'}`}>{isSelected && <Check className="w-3 h-3 text-primary" />}</div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{doc.file_name}</p><p className="text-xs text-muted-foreground">{doc.file_type}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

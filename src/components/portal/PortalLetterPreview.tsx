'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { FileSignature } from 'lucide-react';
import { motion } from 'framer-motion';
import type { LetterForApproval } from '@/components/portal/types';

interface PortalLetterPreviewProps {
  letter: LetterForApproval | null;
  onClose: () => void;
}

export default function PortalLetterPreview({ letter, onClose }: PortalLetterPreviewProps) {
  if (!letter) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[80vh] overflow-hidden"
      >
        <Card className="bg-card border-border shadow-2xl h-full flex flex-col">
          <CardHeader>
            <CardTitle className="font-sans text-lg flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-secondary" />
              Dispute Letter Preview
            </CardTitle>
            <CardDescription className="text-xs flex flex-wrap gap-2">
              <span className="px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground text-[11px]">
                Round {letter.round ?? 1}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground text-[11px] uppercase">
                {letter.bureau}
              </span>
              <span className="text-[11px] text-muted-foreground truncate">
                {letter.creditor_name}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-y-auto border-t border-border/60 bg-muted/20">
            <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
              {letter.letter_content}
            </pre>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

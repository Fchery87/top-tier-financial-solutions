'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FileSignature, Loader2 } from 'lucide-react';
import type { LetterForApproval } from '@/components/portal/types';

interface PortalLetterConsentProps {
  letters: LetterForApproval[];
  pendingLetters: LetterForApproval[];
  signature: string;
  approvingLetters: boolean;
  onSignatureChange: (value: string) => void;
  onApprove: () => void;
  onLetterClick: (letter: LetterForApproval) => void;
}

export default function PortalLetterConsent({
  letters, pendingLetters, signature, approvingLetters,
  onSignatureChange, onApprove, onLetterClick,
}: PortalLetterConsentProps) {
  if (letters.length === 0) return null;

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="font-sans text-xl flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-secondary" />
          Dispute Letters &amp; Consent
        </CardTitle>
        <CardDescription>
          Review the dispute letters prepared for your latest round and approve them electronically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingLetters.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              We&apos;ve prepared {letters.length} letter{letters.length === 1 ? '' : 's'} for your most recent dispute round.
              You can click any letter to preview the full text before approving.
            </p>
            <div className="space-y-2 max-h-[180px] overflow-y-auto">
              {letters.map((letter) => (
                <button
                  key={letter.dispute_id}
                  type="button"
                  onClick={() => onLetterClick(letter)}
                  className="w-full text-left p-3 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{letter.creditor_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Round {letter.round ?? 1} &bull; {letter.bureau.toUpperCase()}
                      </p>
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded-full border ${
                      letter.status === 'approved'
                        ? 'bg-green-500/10 border-green-500/40 text-green-500'
                        : 'bg-yellow-500/10 border-yellow-500/40 text-yellow-500'
                    }`}>
                      {letter.status === 'approved' ? 'Approved' : 'Needs approval'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            <div className="space-y-2 pt-3 border-t border-border/60">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="letter-signature">
                Type your full name as your electronic signature
              </label>
              <Input
                id="letter-signature"
                value={signature}
                onChange={(e) => onSignatureChange(e.target.value)}
                placeholder="Full legal name"
                className="h-9 text-sm"
              />
              <Button
                type="button"
                className="w-full mt-1"
                onClick={onApprove}
                disabled={approvingLetters || pendingLetters.length === 0}
              >
                {approvingLetters ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Recording Approval...</>
                ) : 'Approve Letters'}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            All dispute letters for your latest round have been approved. Thank you.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import * as React from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useWizardContext } from './WizardContext';
import { claimBlockerText, isClaimBlocked } from './services/highRiskClaims';

/**
 * The Configure step's Generate button. It stays disabled while any selected
 * item carries a high-risk claim the client has not confirmed, and says why.
 * Items that are ready can still be generated on their own.
 */
export function WizardGenerateControls() {
  const {
    generating, analyzingItems, analysisProgress, estimatedTimeRemaining,
    generationProgress, generationMethod, combineItemsPerBureau,
    validateCurrentStep, canProceed,
    analyzeItemsWithAI, generateLetters,
    highRiskClaims, readyItemCount,
  } = useWizardContext();

  const blockers = highRiskClaims.filter(isClaimBlocked);
  const busy = generating || analyzingItems;

  const run = async (readyOnly: boolean) => {
    if (!validateCurrentStep()) return;
    const analysisData = generationMethod === 'ai' ? await analyzeItemsWithAI() : null;
    await generateLetters(analysisData, readyOnly ? { readyOnly: true } : undefined);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {blockers.length > 0 && readyItemCount > 0 && (
          <Button type="button" variant="outline" onClick={() => void run(true)} disabled={!canProceed() || busy}>
            Generate {readyItemCount} ready {readyItemCount === 1 ? 'item' : 'items'}
          </Button>
        )}
        <Button
          data-generate-button
          onClick={() => void run(false)}
          disabled={!canProceed() || busy || blockers.length > 0}
        >
          {analyzingItems ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing Items... ({Math.round(analysisProgress)}%)
              {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && <span className="ml-2 text-xs opacity-75">~{estimatedTimeRemaining}s</span>}
            </>
          ) : generating ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating ({generationProgress}%)</>
          ) : (
            <><Sparkles className="w-4 h-4 mr-2" />{generationMethod === 'ai' ? 'Analyze & Generate' : 'Generate Letters'}</>
          )}
        </Button>
      </div>
      {blockers.length > 0 && (
        <div data-testid="high-risk-blockers" className="max-w-xl text-right text-xs text-muted-foreground" aria-live="polite">
          <p className="font-medium text-warning">Waiting on client confirmation:</p>
          <ul className="space-y-0.5">
            {blockers.map(claim => <li key={claim.key}>{claimBlockerText(claim)}</li>)}
          </ul>
          {combineItemsPerBureau && readyItemCount > 0 && (
            <p className="mt-1">The combined letter will leave out blocked items. Generate the ready items now and the others once the client confirms.</p>
          )}
        </div>
      )}
    </div>
  );
}

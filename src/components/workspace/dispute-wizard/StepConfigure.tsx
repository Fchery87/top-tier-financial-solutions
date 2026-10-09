'use client';

import * as React from 'react';
import { Check, Loader2, Sparkles, FileText, Paperclip, Upload, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useWizardContext } from './WizardContext';
import { isHighRiskClaimType } from '@/lib/high-risk-claim-registry';
import { BUREAUS, SECONDARY_BUREAUS } from './types';

interface CfpbEligibilityPreview {
  eligible: boolean;
  reason: string;
  eligibleAt: string | null;
  message: string;
}

export function StepConfigure() {
  const ctx = useWizardContext();
  const {
    selectedClient,
    selectedBureaus, disputeRound, setDisputeRound, targetRecipient, setTargetRecipient, priorDisputeId, setPriorDisputeId,
    selectedMethodology, setSelectedMethodology, recommendedMethodology,
    methodologies, loadingMethodologies,
    generationMethod, setGenerationMethod, combineItemsPerBureau, setCombineItemsPerBureau,
    requestManualReview, setRequestManualReview,
    handleToggleBureau,
    selectedItems, selectedPersonalItems, selectedInquiryItems,
    evidenceDocuments, selectedEvidenceIds, setSelectedEvidenceIds,
    loadingEvidence, evidenceOverrideConfirmed, setEvidenceOverrideConfirmed,
    setShowEvidenceUploadModal,
    selectedReasonCodes,
    creditReports, selectedReportId, setSelectedReportId,
    discrepancySummary, loadingDiscrepancies,
    confidenceThreshold, setConfidenceThreshold,
    showLowConfidenceItems, setShowLowConfidenceItems,
    analysisAggressiveness, setAnalysisAggressiveness,
    analysisPreferencesSaved, saveAnalysisPreferences,
    renderValidationMessages,
  } = ctx;

  const totalSelected = selectedItems.length + selectedPersonalItems.length + selectedInquiryItems.length;
  const selectedCfpbItemIds = React.useMemo(
    () => [...selectedItems, ...selectedPersonalItems, ...selectedInquiryItems],
    [selectedInquiryItems, selectedItems, selectedPersonalItems],
  );
  const [cfpbEligibility, setCfpbEligibility] = React.useState<CfpbEligibilityPreview | null>(null);
  const [loadingCfpbEligibility, setLoadingCfpbEligibility] = React.useState(false);

  React.useEffect(() => {
    if (targetRecipient !== 'cfpb') {
      setCfpbEligibility(null);
      setLoadingCfpbEligibility(false);
      return;
    }

    const disputeId = priorDisputeId.trim();
    if (!disputeId) {
      setCfpbEligibility(null);
      setLoadingCfpbEligibility(false);
      return;
    }

    if (!selectedClient?.id) {
      setCfpbEligibility({
        eligible: false,
        reason: 'client_required',
        eligibleAt: null,
        message: 'Select a client before the CRA predecessor can be matched for CFPB generation.',
      });
      setLoadingCfpbEligibility(false);
      return;
    }

    if (selectedCfpbItemIds.length !== 1) {
      setCfpbEligibility({
        eligible: false,
        reason: 'one_item_required',
        eligibleAt: null,
        message: 'Select exactly one dispute item so the CRA predecessor can be matched before CFPB generation.',
      });
      setLoadingCfpbEligibility(false);
      return;
    }

    const controller = new AbortController();
    setLoadingCfpbEligibility(true);
    setCfpbEligibility(null);
    const query = new URLSearchParams({
      clientId: selectedClient.id,
      negativeItemId: selectedCfpbItemIds[0],
    });

    void fetch(`/api/workspace/disputes/${encodeURIComponent(disputeId)}/cfpb-eligibility?${query.toString()}`, { signal: controller.signal })
      .then(async response => {
        const value: unknown = await response.json().catch(() => ({}));
        const preview = parseCfpbEligibilityPreview(value);
        if (!preview) {
          throw new Error('CFPB eligibility response was invalid');
        }
        setCfpbEligibility(preview);
      })
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setCfpbEligibility({
          eligible: false,
          reason: 'unavailable',
          eligibleAt: null,
          message: 'The prior CRA dispute could not be verified. Generation will be rechecked by the server.',
        });
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCfpbEligibility(false);
      });

    return () => controller.abort();
  }, [priorDisputeId, selectedCfpbItemIds, selectedClient?.id, targetRecipient]);

  React.useEffect(() => {
    if (targetRecipient === 'cfpb' && combineItemsPerBureau) setCombineItemsPerBureau(false);
  }, [combineItemsPerBureau, setCombineItemsPerBureau, targetRecipient]);

  return (
    <Card className="bg-card border border-border">
      <CardHeader>
        <CardTitle>
          Select Dispute Round & Target
          <span className="text-destructive ml-1">*</span>
          {selectedBureaus.length === 0 && (
            <span className="text-xs text-destructive ml-3 font-normal">(Select at least one bureau)</span>
          )}
        </CardTitle>
        <CardDescription>Configure the dispute round and recipients</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderValidationMessages()}

        <div className="space-y-3">
          <label className="text-sm font-medium">Report Scope</label>
          {creditReports.length > 0 ? (
            <select
              value={selectedReportId ?? ''}
              onChange={(e) => setSelectedReportId(e.target.value || null)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {creditReports.map((report) => (
                <option key={report.id} value={report.id}>
                  {report.file_name}{report.bureau ? ` • ${report.bureau}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-sm text-muted-foreground">
              No credit reports available for this client.
            </div>
          )}
        </div>

        {loadingDiscrepancies ? (
          <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-sm text-muted-foreground">Checking for bureau discrepancies...</div>
        ) : discrepancySummary?.highSeverity ? (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            {discrepancySummary.highSeverity} high-severity discrepancies must be resolved before generating letters. Resolve them in the Discrepancies panel, then refresh.
          </div>
        ) : discrepancySummary ? (
          <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-sm text-success">
            No blocking discrepancies detected. ({discrepancySummary.total} total open discrepancies)
          </div>
        ) : null}

        {targetRecipient === 'cfpb' ? (
          <div className="p-3 rounded-lg bg-secondary/10 border border-secondary/20 text-sm text-foreground space-y-3">
            <p>CFPB complaint packet selected. A prior CRA dispute for the same client and item must be submitted and either receive a response or reach its eligibility date before generation.</p>
            <Input aria-label="Prior CRA dispute ID" placeholder="Prior CRA dispute ID" value={priorDisputeId} onChange={event => setPriorDisputeId(event.target.value)} />
            {loadingCfpbEligibility && <p className="text-xs text-muted-foreground" aria-live="polite">Checking the prior CRA dispute eligibility…</p>}
            {!loadingCfpbEligibility && cfpbEligibility && (
              <div data-testid="cfpb-eligibility-preview" data-selected-item-count={selectedCfpbItemIds.length} data-selected-client-id={selectedClient?.id ?? ''} className={cfpbEligibility.eligible ? 'rounded-md bg-success/10 p-3 text-success' : 'rounded-md bg-warning/10 p-3 text-warning'}>
                <p className="font-medium">{cfpbEligibility.eligible ? 'Eligible for CFPB escalation' : `Not eligible yet: ${formatCfpbReason(cfpbEligibility.reason)}`}</p>
                <p className="mt-1 text-xs">{cfpbEligibility.message}</p>
                {cfpbEligibility.eligibleAt && <p className="mt-1 text-xs">Eligible after {formatEligibilityDate(cfpbEligibility.eligibleAt)}.</p>}
              </div>
            )}
            <p className="text-xs text-muted-foreground">The server rechecks ownership, submission state, and the eligible date. CFPB packets are generated individually so each item has one attributable CRA predecessor.</p>
          </div>
        ) : targetRecipient !== 'bureau' ? (
          <div data-testid="direct-dispute-advisory" className="p-3 rounded-lg bg-secondary/10 border border-secondary/20 text-sm text-foreground">
            Enhanced creditor/furnisher letters enabled. This escalation will cite prior verification attempts and request direct investigation from the data furnisher.
            <p className="mt-2 text-xs text-muted-foreground">Under Regulation V, a furnisher may decline the direct-dispute investigation process when it reasonably believes a credit repair organization prepared or supplied the dispute. This is advisory; you can continue.</p>
          </div>
        ) : null}

        {/* Round Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Dispute Round</label>
          <div className="space-y-2">
            {[
              { round: 1, label: 'Round 1 - Bureau Disputes', desc: 'Initial dispute sent to credit bureaus' },
              { round: 2, label: 'Round 2 - Direct to Creditor/Furnisher', desc: 'Escalation after bureau verification' },
              { round: 3, label: 'Round 3+ - CFPB / Direct Escalation', desc: 'CFPB complaint packet or direct furnisher follow-up' },
            ].map(({ round, label, desc }) => (
              <div key={round} className={`p-4 rounded-lg border cursor-pointer transition-all ${disputeRound === round ? 'border-secondary bg-secondary/10' : 'border-border hover:border-secondary/50'}`} onClick={() => { setDisputeRound(round); if (round === 1) setTargetRecipient('bureau'); else if (round === 2) setTargetRecipient('creditor'); else setTargetRecipient('cfpb'); }}>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 ${disputeRound === round ? 'border-secondary bg-secondary' : 'border-muted-foreground/30'}`} />
                  <div><p className="font-medium">{label}</p><p className="text-sm text-muted-foreground">{desc}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Methodology Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Dispute Strategy</label>
            {recommendedMethodology && recommendedMethodology !== selectedMethodology && (
              <button onClick={() => setSelectedMethodology(recommendedMethodology)} className="text-xs text-secondary hover:underline">
                Use recommended: {methodologies.find(m => m.code === recommendedMethodology)?.name}
              </button>
            )}
          </div>
          {loadingMethodologies ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-secondary" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {methodologies.filter(m => m.roundRange.includes(disputeRound)).map((methodology) => (
                <div key={methodology.code} className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedMethodology === methodology.code ? 'border-secondary bg-secondary/10' : 'border-border hover:border-secondary/50'}`} onClick={() => setSelectedMethodology(methodology.code)}>
                  <div className="flex items-start gap-3">
                    <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0 ${selectedMethodology === methodology.code ? 'border-secondary bg-secondary' : 'border-muted-foreground/30'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{methodology.name}</p>
                        {recommendedMethodology === methodology.code && <span className="text-xs px-1.5 py-0.5 rounded bg-success/15 text-success">Recommended</span>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{methodology.description}</p>
                      {methodology.bestFor.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {methodology.bestFor.slice(0, 2).map((use, i) => <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{use}</span>)}
                          {methodology.bestFor.length > 2 && <span className="text-xs text-muted-foreground">+{methodology.bestFor.length - 2} more</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Manual review preference */}
        <div className="space-y-3 p-4 rounded-lg bg-secondary/10 border border-secondary/20">
          <div className="flex items-start gap-3">
            <input type="checkbox" id="requestManualReview" checked={requestManualReview} onChange={(e) => setRequestManualReview(e.target.checked)} className="mt-1 w-4 h-4 cursor-pointer" />
            <div className="flex-1">
              <label htmlFor="requestManualReview" className="text-sm font-medium cursor-pointer">Request Manual Review</label>
              <p className="text-xs text-muted-foreground mt-1">Adds a factual request for individualized investigation and written verification details where appropriate, without making unsupported demands about bureau processing systems.</p>
              <p className="text-xs text-secondary mt-2"><strong>Recommended for:</strong> Cases with evidence, identity theft claims, or complex disputed facts</p>
            </div>
          </div>
        </div>

        {/* Bureau Selection */}
        {targetRecipient === 'bureau' && (
          <div className="space-y-3">
            <label className="text-sm font-medium">Select Credit Bureaus</label>
            <div className="flex flex-wrap gap-3">
              {BUREAUS.map((bureau) => (
                <Button key={bureau.code} variant={selectedBureaus.includes(bureau.code) ? 'secondary' : 'outline'} onClick={() => handleToggleBureau(bureau.code)}>
                  {selectedBureaus.includes(bureau.code) && <Check className="w-4 h-4 mr-2" />}
                  {bureau.label}
                </Button>
              ))}
            </div>
            <label className="text-sm font-medium block pt-2">Secondary Agencies (optional)</label>
            <div className="flex flex-wrap gap-3">
              {SECONDARY_BUREAUS.map((bureau) => (
                <Button key={bureau.code} variant={selectedBureaus.includes(bureau.code) ? 'secondary' : 'outline'} onClick={() => handleToggleBureau(bureau.code)}>
                  {selectedBureaus.includes(bureau.code) && <Check className="w-4 h-4 mr-2" />}
                  {bureau.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Secondary consumer reporting agencies receive a letter covering all selected items. Useful after big-3 deletions so the data does not resurface from LexisNexis, Innovis, or banking-history agencies.</p>
          </div>
        )}

        {/* Generation Method */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Letter Generation Method</label>
          <div className="flex gap-3">
            <Button variant={generationMethod === 'ai' ? 'secondary' : 'outline'} className="flex-1" onClick={() => setGenerationMethod('ai')}>
              <Sparkles className="w-4 h-4 mr-2" />AI-Generated (Unique)
            </Button>
            <Button variant={generationMethod === 'template' ? 'secondary' : 'outline'} className="flex-1" onClick={() => setGenerationMethod('template')}>
              <FileText className="w-4 h-4 mr-2" />Template-Based
            </Button>
          </div>
          {generationMethod === 'ai' && (
            <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-sm">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-success">AI Analysis Mode</p>
                  <p className="text-muted-foreground mt-1">The AI will automatically analyze your selected items using Metro 2 compliance knowledge to:</p>
                  <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs list-disc list-inside">
                    <li>Identify the best dispute methodology</li><li>Detect Metro 2 field violations</li><li>Select appropriate reason codes</li><li>Generate unique, FCRA-compliant letters</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Combined Letters Option */}
        {targetRecipient === 'bureau' && totalSelected > 1 && (
          <div className="space-y-3">
            <label className="text-sm font-medium">Letter Format</label>
            <div className="space-y-2">
              <div className={`p-4 rounded-lg border cursor-pointer transition-all ${combineItemsPerBureau ? 'border-secondary bg-secondary/10' : 'border-border hover:border-secondary/50'}`} onClick={() => setCombineItemsPerBureau(true)}>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 ${combineItemsPerBureau ? 'border-secondary bg-secondary' : 'border-muted-foreground/30'}`} />
                  <div><p className="font-medium">Combined Letter per Bureau (Recommended)</p><p className="text-sm text-muted-foreground">{totalSelected} items combined into {selectedBureaus.length} letter(s) - one per bureau</p></div>
                </div>
              </div>
              <div className={`p-4 rounded-lg border cursor-pointer transition-all ${!combineItemsPerBureau ? 'border-secondary bg-secondary/10' : 'border-border hover:border-secondary/50'}`} onClick={() => setCombineItemsPerBureau(false)}>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 ${!combineItemsPerBureau ? 'border-secondary bg-secondary' : 'border-muted-foreground/30'}`} />
                  <div><p className="font-medium">Individual Letter per Item</p><p className="text-sm text-muted-foreground">{totalSelected * selectedBureaus.length} separate letters - one per item per bureau</p></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Evidence Picker */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium flex items-center gap-2"><Paperclip className="w-4 h-4" />Evidence Attachments (Enclosures)</label>
            <span className="text-xs text-muted-foreground">{selectedEvidenceIds.length} selected</span>
          </div>
          {loadingEvidence ? (
            <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-secondary" /></div>
          ) : evidenceDocuments.length === 0 ? (
            <div className="p-3 rounded-lg bg-muted/50 text-center text-sm text-muted-foreground">
              <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-50" /><p>No documents uploaded for this client.</p>
              <p className="text-xs mt-1">Standard enclosures (ID, proof of address) will be included automatically.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {evidenceDocuments.map((doc) => {
                const isSelected = selectedEvidenceIds.includes(doc.id);
                return (
                  <div key={doc.id} className={`p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'border-secondary bg-secondary/10' : 'border-border hover:border-secondary/50'}`} onClick={() => setSelectedEvidenceIds(prev => isSelected ? prev.filter(id => id !== doc.id) : [...prev, doc.id])}>
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSelected ? 'border-secondary bg-secondary' : 'border-muted-foreground/30'}`}>{isSelected && <Check className="w-3 h-3 text-primary" />}</div>
                      <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{doc.file_name}</p><p className="text-xs text-muted-foreground">{doc.file_type}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedReasonCodes.some(isHighRiskClaimType) && selectedEvidenceIds.length === 0 && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-warning">Evidence Required for High-Risk Claims</p>
                  <p className="text-xs text-muted-foreground mt-1">The selected reason codes require supporting documentation.</p>
                  <label className="flex items-center gap-2 mt-2">
                    <input type="checkbox" checked={evidenceOverrideConfirmed} onChange={(e) => setEvidenceOverrideConfirmed(e.target.checked)} className="rounded border-warning" />
                    <span className="text-xs text-warning">I confirm client has provided verbal verification of these claims</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={() => setShowEvidenceUploadModal(true)}>
            <Upload className="w-4 h-4 mr-2" />Upload Evidence Documents
          </Button>

          {/* AI Analysis Settings */}
          {generationMethod === 'ai' && (
            <div data-analysis-settings className="space-y-3 p-4 rounded-lg bg-secondary/10 border border-secondary/20">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Analysis Settings</label>
                <button onClick={() => setShowLowConfidenceItems(!showLowConfidenceItems)} className="text-xs text-secondary hover:underline">{showLowConfidenceItems ? 'Hide' : 'Show'} Low Confidence Items</button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Minimum Confidence Threshold</span>
                  <span className="text-xs font-semibold text-secondary">{Math.round(confidenceThreshold * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.1" value={confidenceThreshold} onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))} className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-secondary" />
                <div className="flex justify-between text-xs text-muted-foreground"><span>Low</span><span>High</span></div>
              </div>
              <p className="text-xs text-muted-foreground italic">Adjust the threshold to filter recommendations. Higher threshold = only highest-confidence items.</p>

              <div className="border-t border-secondary/20 pt-3 mt-3">
                <p className="text-xs font-medium text-foreground mb-2">Analysis Aggressiveness</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['conservative', 'balanced', 'aggressive'] as const).map((level) => (
                    <button key={level} onClick={() => setAnalysisAggressiveness(level)} className={`px-3 py-2 rounded text-xs font-medium transition-all ${analysisAggressiveness === level ? level === 'aggressive' ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-secondary-foreground' : 'bg-muted text-foreground hover:bg-muted/70'}`}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2 italic">
                  {analysisAggressiveness === 'conservative' ? 'Conservative: Finds only the strongest violations' : analysisAggressiveness === 'balanced' ? 'Balanced: Balanced strength and comprehensiveness' : 'Aggressive: Finds all potential violations (may be less precise)'}
                </p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={saveAnalysisPreferences} className="flex-1 text-xs">{analysisPreferencesSaved ? '✓ Saved' : 'Save Preferences'}</Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function parseCfpbEligibilityPreview(value: unknown): CfpbEligibilityPreview | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const eligible = candidate.eligible;
  const reason = candidate.reason;
  const eligibleAt = candidate.eligible_at;
  const message = candidate.message;
  if (typeof eligible !== 'boolean' || typeof reason !== 'string' || typeof message !== 'string') return null;
  if (eligibleAt !== null && typeof eligibleAt !== 'string') return null;
  return { eligible, reason, eligibleAt, message };
}

function formatCfpbReason(reason: string): string {
  return reason.replaceAll('_', ' ');
}

function formatEligibilityDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

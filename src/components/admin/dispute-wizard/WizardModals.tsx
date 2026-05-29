'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, AlertTriangle, Loader2, Paperclip, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EvidenceUploadModal } from '@/components/admin/EvidenceUploadModal';
import { useWizardContext } from './WizardContext';

export function WizardModals() {
  const ctx = useWizardContext();
  const {
    operationError, showErrorModal, setShowErrorModal, setOperationError,
    failedAnalysisItems, generationMethod, analyzingItems,
    analysisRetryCount, analysisProgress, analysisTotalItems, estimatedTimeRemaining,
    analyzeItemsWithAI,
    showDraftRecovery, setShowDraftRecovery, draftMetadata,
    clients, wizardDraft,
    setClientSearch, setSelectedClient,
    fetchNegativeItems, setSelectedItems, setSelectedPersonalItems, setSelectedInquiryItems,
    setActiveTab, setItemDisputeInstructions, setDisputeRound, setTargetRecipient,
    setSelectedBureaus, setGenerationMethod, setCombineItemsPerBureau, setSelectedMethodology,
    setRequestManualReview, setSelectedEvidenceIds, setCurrentStep, setSelectedReasonCodes,
    showEvidenceBlockingModal, setShowEvidenceBlockingModal,
    evidenceBlockingStatus, setEvidenceBlockingStatus,
    setEvidenceOverrideConfirmed,
    showEvidenceUploadModal, setShowEvidenceUploadModal,
    selectedReasonCodes, evidenceDocuments, handleUploadEvidence, handleRemoveEvidence,
    negativeItems, personalInfoItems, inquiryItems,
  } = ctx;

  const hasFailedItems = failedAnalysisItems.size > 0 && generationMethod === 'ai';

  return (
    <>
      {/* Error Alert Modal */}
      {operationError && showErrorModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive"><AlertCircle className="w-5 h-5" />Analysis Error</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{operationError}</p>
                {hasFailedItems && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-xs font-semibold text-destructive mb-2">Failed Items ({failedAnalysisItems.size}):</p>
                    <ul className="text-xs text-destructive space-y-1">
                      {Array.from(failedAnalysisItems).slice(0, 3).map((itemId) => {
                        const item = negativeItems.find(i => i.id === itemId) || personalInfoItems.find(i => i.id === itemId) || inquiryItems.find(i => i.id === itemId);
                        let displayName = itemId;
                        if (item && 'creditor_name' in item && typeof item.creditor_name === 'string') displayName = item.creditor_name;
                        return <li key={itemId} className="list-disc list-inside">{displayName}</li>;
                      })}
                      {failedAnalysisItems.size > 3 && <li className="text-destructive font-medium">+{failedAnalysisItems.size - 3} more items</li>}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" onClick={() => { setShowErrorModal(false); setOperationError(null); }}>Dismiss</Button>
                  {hasFailedItems && analysisRetryCount < 3 && (
                    <Button onClick={async () => { setShowErrorModal(false); setOperationError(null); await analyzeItemsWithAI(true); }} className="bg-warning text-warning-foreground hover:bg-warning/90" disabled={analyzingItems}>
                      {analyzingItems ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Retrying...</> : <><Zap className="w-4 h-4 mr-2" />Retry {failedAnalysisItems.size} Item{failedAnalysisItems.size !== 1 ? 's' : ''}</>}
                    </Button>
                  )}
                  <Button onClick={() => { setShowErrorModal(false); setOperationError(null); }} className="bg-primary text-primary-foreground hover:bg-primary/90">Continue</Button>
                </div>
                {analysisRetryCount >= 3 && hasFailedItems && (
                  <p className="text-xs text-destructive italic">Maximum retry attempts reached. Please try with fewer items or contact support.</p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Draft Recovery Modal */}
      {showDraftRecovery && draftMetadata && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Paperclip className="w-5 h-5 text-secondary" />Resume Draft?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <p><strong>Client:</strong> {draftMetadata.clientName || 'Unknown'}</p>
                <p><strong>Items:</strong> {draftMetadata.itemCount || 0}</p>
                <p><strong>Last Saved:</strong> {new Date(draftMetadata.lastSavedAt).toLocaleString()}</p>
              </div>
              <p className="text-sm text-muted-foreground">You have a saved draft from a previous session. Would you like to resume where you left off?</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setShowDraftRecovery(false); wizardDraft.clearDraft(); }}>Start New</Button>
                <Button
                  onClick={async () => {
                    const draft = wizardDraft.loadDraft();
                    if (!draft) { setShowDraftRecovery(false); return; }
                    if (draft.selectedClientId) {
                      let clientToRestore = clients.find(c => c.id === draft.selectedClientId);
                      if (!clientToRestore && draft.clientSearch) {
                        setClientSearch(draft.clientSearch);
                        const allClientsResponse = await fetch(`/api/admin/clients?limit=1000&status=active`);
                        if (allClientsResponse.ok) { const allClientsData = await allClientsResponse.json(); clientToRestore = allClientsData.items.find((c: import('./types').Client) => c.id === draft.selectedClientId); }
                      }
                      if (clientToRestore) { setSelectedClient(clientToRestore); await fetchNegativeItems(clientToRestore.id); }
                    }
                    if (draft.selectedItems) setSelectedItems(draft.selectedItems);
                    if (draft.selectedPersonalItems) setSelectedPersonalItems(draft.selectedPersonalItems);
                    if (draft.selectedInquiryItems) setSelectedInquiryItems(draft.selectedInquiryItems);
                    if (draft.activeTab) setActiveTab(draft.activeTab);
                    if (draft.itemDisputeInstructions) {
                      if (Array.isArray(draft.itemDisputeInstructions)) setItemDisputeInstructions(new Map(draft.itemDisputeInstructions));
                      else if (draft.itemDisputeInstructions instanceof Map) setItemDisputeInstructions(draft.itemDisputeInstructions);
                    }
                    if (draft.disputeRound !== undefined) setDisputeRound(draft.disputeRound);
                    if (draft.targetRecipient) setTargetRecipient(draft.targetRecipient);
                    if (draft.selectedBureaus) setSelectedBureaus(draft.selectedBureaus);
                    if (draft.generationMethod) setGenerationMethod(draft.generationMethod);
                    if (draft.combineItemsPerBureau !== undefined) setCombineItemsPerBureau(draft.combineItemsPerBureau);
                    if (draft.selectedMethodology) setSelectedMethodology(draft.selectedMethodology);
                    if (draft.requestManualReview !== undefined) setRequestManualReview(draft.requestManualReview);
                    if (draft.selectedEvidenceIds) setSelectedEvidenceIds(draft.selectedEvidenceIds);
                    if (draft.selectedReasonCodes) setSelectedReasonCodes(draft.selectedReasonCodes);
                    setCurrentStep(draft.currentStep || 1);
                    setShowDraftRecovery(false);
                  }}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Resume Draft
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Evidence Blocking Modal */}
      {showEvidenceBlockingModal && evidenceBlockingStatus && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="w-5 h-5" />Evidence Required for High-Risk Disputes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="text-sm text-destructive font-medium mb-3">⚠️ This dispute uses high-risk reason codes that require supporting evidence:</p>
                <ul className="space-y-2">{evidenceBlockingStatus.blockingReasons.map((reason, idx) => <li key={idx} className="text-sm text-destructive">• {reason}</li>)}</ul>
              </div>
              {evidenceBlockingStatus.requiredEvidenceMissing.length > 0 && (
                <div className="bg-secondary/10 border border-secondary/20 rounded-lg p-4">
                  <p className="text-sm text-foreground font-medium mb-2">Required Evidence:</p>
                  <ul className="space-y-1">{evidenceBlockingStatus.requiredEvidenceMissing.map((doc, idx) => <li key={idx} className="text-sm text-muted-foreground">• {doc}</li>)}</ul>
                </div>
              )}
              <p className="text-sm text-muted-foreground">Please upload the required evidence documents before proceeding. Evidence significantly strengthens high-risk disputes.</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setShowEvidenceBlockingModal(false); setEvidenceBlockingStatus(null); setShowEvidenceUploadModal(true); }}>Cancel & Upload Evidence</Button>
                <Button onClick={() => { setEvidenceOverrideConfirmed(true); setShowEvidenceBlockingModal(false); setTimeout(() => { const btn = document.querySelector('[data-generate-button]') as HTMLButtonElement; btn?.click(); }, 0); }} className="bg-warning text-warning-foreground hover:bg-warning/90">Proceed Without Evidence (Admin Override)</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Evidence Upload Modal */}
      <EvidenceUploadModal
        isOpen={showEvidenceUploadModal}
        onClose={() => setShowEvidenceUploadModal(false)}
        onUpload={handleUploadEvidence}
        onRemove={handleRemoveEvidence}
        reasonCodes={selectedReasonCodes}
        existingDocuments={evidenceDocuments}
      />

      {/* Analysis Progress Modal */}
      {analyzingItems && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md bg-card border border-border/50 rounded-lg shadow-lg p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3"><Loader2 className="w-5 h-5 text-secondary animate-spin" /><h2 className="text-lg font-semibold text-foreground">Analyzing Items</h2></div>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">Item <span className="text-foreground">{analysisProgress.toFixed(0)}</span> of <span className="text-foreground">{analysisTotalItems}</span></p>
              </div>
              <div className="space-y-2">
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <motion.div className="bg-secondary h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${Math.min(analysisProgress, 100)}%` }} transition={{ duration: 0.3 }} />
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>{Math.round(analysisProgress)}% Complete</span>
                  {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && <span>~{estimatedTimeRemaining}s remaining</span>}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-secondary/10 border border-secondary/20">
                <p className="text-sm text-foreground">Analyzing accounts for disputes and gathering Metro 2 violation data...</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}

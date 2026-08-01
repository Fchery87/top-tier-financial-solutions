import * as React from 'react';
import { useWizardDraft, hasDraft, getDraftMetadata, type DraftMetadata, type WizardDraftData } from '@/hooks/useWizardDraft';
import type { Client, GenerationMethod, ItemDisputeInstruction, ItemTab, TargetRecipient } from '../types';

interface UseWizardDraftRecoveryOptions {
  selectedClient: Client | null;
  clientSearch: string;
  selectedItems: string[];
  selectedPersonalItems: string[];
  selectedInquiryItems: string[];
  activeTab: ItemTab;
  itemDisputeInstructions: Map<string, ItemDisputeInstruction>;
  disputeRound: number;
  targetRecipient: TargetRecipient;
  selectedBureaus: string[];
  generationMethod: GenerationMethod;
  combineItemsPerBureau: boolean;
  selectedMethodology: string | null;
  requestManualReview: boolean;
  selectedEvidenceIds: string[];
  currentStep: number;
  selectedReasonCodes: string[];
}

export function useWizardDraftRecovery({
  selectedClient,
  clientSearch,
  selectedItems,
  selectedPersonalItems,
  selectedInquiryItems,
  activeTab,
  itemDisputeInstructions,
  disputeRound,
  targetRecipient,
  selectedBureaus,
  generationMethod,
  combineItemsPerBureau,
  selectedMethodology,
  requestManualReview,
  selectedEvidenceIds,
  currentStep,
  selectedReasonCodes,
}: UseWizardDraftRecoveryOptions) {
  const [showDraftRecovery, setShowDraftRecovery] = React.useState(false);
  const [draftMetadata, setDraftMetadata] = React.useState<DraftMetadata | null>(null);
  const wizardDraft = useWizardDraft(selectedClient?.id);

  React.useEffect(() => {
    if (hasDraft()) {
      setDraftMetadata(getDraftMetadata());
      setShowDraftRecovery(true);
    }
  }, []);

  React.useEffect(() => {
    if (!selectedClient) return;
    const draftData: WizardDraftData = {
      selectedClientId: selectedClient.id,
      clientSearch,
      selectedItems,
      selectedPersonalItems,
      selectedInquiryItems,
      activeTab,
      itemDisputeInstructions,
      disputeRound,
      targetRecipient,
      selectedBureaus,
      generationMethod,
      combineItemsPerBureau,
      selectedMethodology: selectedMethodology ?? undefined,
      requestManualReview,
      selectedEvidenceIds,
      currentStep,
      selectedReasonCodes,
    };
    wizardDraft.setupAutoSave(draftData, { clientName: `${selectedClient.first_name} ${selectedClient.last_name}` });
    return () => {};
  }, [
    activeTab,
    clientSearch,
    combineItemsPerBureau,
    currentStep,
    disputeRound,
    generationMethod,
    itemDisputeInstructions,
    requestManualReview,
    selectedBureaus,
    selectedClient,
    selectedEvidenceIds,
    selectedInquiryItems,
    selectedItems,
    selectedMethodology,
    selectedPersonalItems,
    selectedReasonCodes,
    targetRecipient,
    wizardDraft,
  ]);

  return {
    showDraftRecovery,
    setShowDraftRecovery,
    draftMetadata,
    setDraftMetadata,
    wizardDraft,
  };
}

import * as React from 'react';
import {
  validateEvidenceRequirements,
  type EvidenceValidationResult,
} from '@/lib/dispute-wizard-validation';
import { buildLetterGenerationPayload } from '../services/buildLetterGenerationPayload';
import type {
  AIAnalysisResult,
  AIAnalysisSummary,
  Client,
  GenerationMethod,
  InquiryItem,
  NegativeItem,
  PersonalInfoItem,
  TargetRecipient,
} from '../types';
import type { LetterGenerationRequestPlan } from '../types/letter-generation';

interface UseGenerateDisputeLettersOptions {
  selectedClient: Client | null;
  negativeItems: NegativeItem[];
  selectedItems: string[];
  personalInfoItems: PersonalInfoItem[];
  selectedPersonalItems: string[];
  inquiryItems: InquiryItem[];
  selectedInquiryItems: string[];
  generationMethod: GenerationMethod;
  selectedReasonCodes: string[];
  aiAnalysisResults: AIAnalysisResult[];
  aiAnalysisSummary: AIAnalysisSummary | null;
  selectedMethodology: string;
  selectedBureaus: string[];
  targetRecipient: TargetRecipient;
  selectedDisputeType: string;
  disputeRound: number;
  customReason: string;
  combineItemsPerBureau: boolean;
  selectedEvidenceIds: string[];
  requestManualReview: boolean;
  evidenceOverrideConfirmed: boolean;
  getInstructionText: (itemId: string) => string;
  hasItemInstruction: (itemId: string) => boolean;
  itemAppearsOnBureau: (item: NegativeItem, bureau: string) => boolean;
  generateLettersFromPlan: (
    requests: LetterGenerationRequestPlan[],
    options?: { onError?: (error: unknown, request: LetterGenerationRequestPlan) => void },
  ) => Promise<unknown>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  reviewStepId: number;
}

export function useGenerateDisputeLetters({
  selectedClient,
  negativeItems,
  selectedItems,
  personalInfoItems,
  selectedPersonalItems,
  inquiryItems,
  selectedInquiryItems,
  generationMethod,
  selectedReasonCodes,
  aiAnalysisResults,
  aiAnalysisSummary,
  selectedMethodology,
  selectedBureaus,
  targetRecipient,
  selectedDisputeType,
  disputeRound,
  customReason,
  combineItemsPerBureau,
  selectedEvidenceIds,
  requestManualReview,
  evidenceOverrideConfirmed,
  getInstructionText,
  hasItemInstruction,
  itemAppearsOnBureau,
  generateLettersFromPlan,
  setCurrentStep,
  reviewStepId,
}: UseGenerateDisputeLettersOptions) {
  const [evidenceBlockingStatus, setEvidenceBlockingStatus] = React.useState<EvidenceValidationResult | null>(null);
  const [showEvidenceBlockingModal, setShowEvidenceBlockingModal] = React.useState(false);

  const generateLetters = React.useCallback(async (analysisData?: { analyses: AIAnalysisResult[]; summary: AIAnalysisSummary } | null) => {
    if (!selectedClient) return;

    const usedReasonCodes = generationMethod === 'ai'
      ? (analysisData?.summary?.allReasonCodes || aiAnalysisSummary?.allReasonCodes || [])
      : selectedReasonCodes;
    const evidenceValidation = validateEvidenceRequirements(usedReasonCodes, selectedEvidenceIds, selectedItems);
    if (!evidenceValidation.isValid && !evidenceOverrideConfirmed) {
      setEvidenceBlockingStatus(evidenceValidation);
      setShowEvidenceBlockingModal(true);
      return;
    }

    const effectiveAnalyses = analysisData?.analyses || aiAnalysisResults;
    const effectiveSummary = analysisData?.summary || aiAnalysisSummary;
    const generationPlan = buildLetterGenerationPayload({
      selectedClientId: selectedClient.id,
      negativeItems,
      selectedItems,
      personalInfoItems,
      selectedPersonalItems,
      inquiryItems,
      selectedInquiryItems,
      generationMethod,
      selectedReasonCodes,
      effectiveAnalyses,
      effectiveSummary,
      selectedMethodology,
      selectedBureaus,
      targetRecipient,
      selectedDisputeType,
      disputeRound,
      customReason,
      combineItemsPerBureau,
      selectedEvidenceIds,
      requestManualReview,
      getInstructionText,
      hasItemInstruction,
      itemAppearsOnBureau,
    });

    if (generationPlan.selectedDisputeItems.length === 0) return;

    await generateLettersFromPlan(generationPlan.requests, {
      onError: (error, request) => {
        console.error(request.combined ? 'Error generating combined letter:' : 'Error generating letter:', error);
      },
    });
    setCurrentStep(reviewStepId);
  }, [
    selectedClient,
    negativeItems,
    selectedItems,
    personalInfoItems,
    selectedPersonalItems,
    inquiryItems,
    selectedInquiryItems,
    generationMethod,
    selectedReasonCodes,
    aiAnalysisResults,
    aiAnalysisSummary,
    selectedMethodology,
    selectedBureaus,
    targetRecipient,
    selectedDisputeType,
    disputeRound,
    customReason,
    combineItemsPerBureau,
    selectedEvidenceIds,
    requestManualReview,
    evidenceOverrideConfirmed,
    getInstructionText,
    hasItemInstruction,
    itemAppearsOnBureau,
    generateLettersFromPlan,
    setCurrentStep,
    reviewStepId,
  ]);

  return {
    evidenceBlockingStatus,
    setEvidenceBlockingStatus,
    showEvidenceBlockingModal,
    setShowEvidenceBlockingModal,
    generateLetters,
  };
}

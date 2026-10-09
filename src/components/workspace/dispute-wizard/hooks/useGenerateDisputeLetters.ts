import * as React from 'react';
import { toast } from 'sonner';
import { buildLetterGenerationPayload, buildSelectedDisputeItems, disputeItemKey } from '../services/buildLetterGenerationPayload';
import {
  claimBlockerText,
  HighRiskConfirmationRequiredError,
  highRiskClaimTargets,
  isClaimBlocked,
  itemKeyOfClaim,
} from '../services/highRiskClaims';
import { useHighRiskConfirmations } from './useHighRiskConfirmations';
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
import type { LetterGenerationBuilderInput, LetterGenerationRequestPlan } from '../types/letter-generation';

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
  priorDisputeId: string;
  selectedDisputeType: string;
  disputeRound: number;
  customReason: string;
  combineItemsPerBureau: boolean;
  selectedEvidenceIds: string[];
  requestManualReview: boolean;
  getInstructionText: (itemId: string) => string;
  hasItemInstruction: (itemId: string) => boolean;
  getItemReasonCode: (itemId: string) => string | null;
  itemAppearsOnBureau: (item: NegativeItem, bureau: string) => boolean;
  generateLettersFromPlan: (
    requests: LetterGenerationRequestPlan[],
    options?: { onError?: (error: unknown, request: LetterGenerationRequestPlan) => void },
  ) => Promise<unknown>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  reviewStepId: number;
}

export interface GenerateLettersOptions {
  /** Generate only the items with no unconfirmed high-risk claim. */
  readyOnly?: boolean;
}

export type GenerateLettersAnalysis = { analyses: AIAnalysisResult[]; summary: AIAnalysisSummary } | null;

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
  priorDisputeId,
  selectedDisputeType,
  disputeRound,
  customReason,
  combineItemsPerBureau,
  selectedEvidenceIds,
  requestManualReview,
  getInstructionText,
  hasItemInstruction,
  getItemReasonCode,
  itemAppearsOnBureau,
  generateLettersFromPlan,
  setCurrentStep,
  reviewStepId,
}: UseGenerateDisputeLettersOptions) {
  const builderInput: LetterGenerationBuilderInput | null = React.useMemo(() => {
    if (!selectedClient) return null;
    return {
      selectedClientId: selectedClient.id,
      negativeItems,
      selectedItems,
      personalInfoItems,
      selectedPersonalItems,
      inquiryItems,
      selectedInquiryItems,
      generationMethod,
      selectedReasonCodes,
      effectiveAnalyses: aiAnalysisResults,
      effectiveSummary: aiAnalysisSummary,
      selectedMethodology,
      selectedBureaus,
      targetRecipient,
      priorDisputeId,
      selectedDisputeType,
      disputeRound,
      customReason,
      combineItemsPerBureau,
      selectedEvidenceIds,
      requestManualReview,
      getInstructionText,
      hasItemInstruction,
      getItemReasonCode,
      itemAppearsOnBureau,
    };
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
    priorDisputeId,
    selectedDisputeType,
    disputeRound,
    customReason,
    combineItemsPerBureau,
    selectedEvidenceIds,
    requestManualReview,
    getInstructionText,
    hasItemInstruction,
    getItemReasonCode,
    itemAppearsOnBureau,
  ]);

  const highRiskTargets = React.useMemo(() => (builderInput ? highRiskClaimTargets(builderInput) : []), [builderInput]);
  const {
    claims: highRiskClaims,
    requestingKey: requestingConfirmationKey,
    requestClientConfirmation,
    refreshClientConfirmation,
    confirmationFor,
  } = useHighRiskConfirmations({ clientId: selectedClient?.id, targets: highRiskTargets });

  const readyItemCount = React.useMemo(() => {
    if (!builderInput) return 0;
    const blocked = new Set(highRiskClaims.filter(isClaimBlocked).map(itemKeyOfClaim));
    return buildSelectedDisputeItems(builderInput)
      .filter(entry => !blocked.has(disputeItemKey(entry.kind, entry.payload.id)))
      .length;
  }, [builderInput, highRiskClaims]);

  const generateLetters = React.useCallback(async (analysisData?: GenerateLettersAnalysis, options: GenerateLettersOptions = {}) => {
    if (!builderInput) return;

    const input: LetterGenerationBuilderInput = {
      ...builderInput,
      effectiveAnalyses: analysisData?.analyses || builderInput.effectiveAnalyses,
      effectiveSummary: analysisData?.summary || builderInput.effectiveSummary,
    };

    // AI analysis can add a high-risk code, so the claims are re-derived here.
    const blocked = highRiskClaimTargets(input).map(confirmationFor).filter(isClaimBlocked);
    if (blocked.length > 0 && !options.readyOnly) {
      toast.error(`Client confirmation is needed before these letters can be generated. ${blocked.map(claimBlockerText).join('; ')}.`);
      return;
    }

    const generationPlan = buildLetterGenerationPayload({
      ...input,
      excludedItemKeys: blocked.length > 0 ? new Set(blocked.map(itemKeyOfClaim)) : undefined,
    });
    if (generationPlan.selectedDisputeItems.length === 0) return;

    await generateLettersFromPlan(generationPlan.requests, {
      onError: (error, request) => {
        if (error instanceof HighRiskConfirmationRequiredError) {
          toast.error(`Could not generate the ${request.bureau} letter. ${error.message}`);
          for (const item of request.items) refreshClientConfirmation({ itemKind: item.kind, itemId: item.id });
          return;
        }
        console.error(request.combined ? 'Error generating combined letter:' : 'Error generating letter:', error);
        toast.error(`Could not generate the ${request.bureau} letter: ${error instanceof Error ? error.message : 'Unknown error'}`);
      },
    });
    setCurrentStep(reviewStepId);
  }, [builderInput, confirmationFor, generateLettersFromPlan, refreshClientConfirmation, setCurrentStep, reviewStepId]);

  return {
    generateLetters,
    highRiskClaims,
    readyItemCount,
    requestingConfirmationKey,
    requestClientConfirmation,
    refreshClientConfirmation,
  };
}

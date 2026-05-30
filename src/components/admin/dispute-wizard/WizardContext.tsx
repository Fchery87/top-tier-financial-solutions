'use client';

import * as React from 'react';
import { type EvidenceValidationResult } from '@/lib/dispute-wizard-validation';
import { useWizardDraft, type DraftMetadata } from '@/hooks/useWizardDraft';
import { type StepStatus } from '@/components/admin/DisputeWizardProgressBar';
import { useLetterGeneration } from './hooks/useLetterGeneration';
import { useEvidenceSelection } from './hooks/useEvidenceSelection';
import { useAIAnalysis } from './hooks/useAIAnalysis';
import { useDisputeAutoSelection } from './hooks/useDisputeAutoSelection';
import { useDisputeItems } from './hooks/useDisputeItems';
import { useDisputeMethodologies } from './hooks/useDisputeMethodologies';
import { useDisputeIntelligence } from './hooks/useDisputeIntelligence';
import { useWizardClients } from './hooks/useWizardClients';
import { useBulkDisputeSubmission } from './hooks/useBulkDisputeSubmission';
import { useDisputeWizardOptions } from './hooks/useDisputeWizardOptions';
import { useItemDisputeInstructions } from './hooks/useItemDisputeInstructions';
import { useLetterExportActions } from './hooks/useLetterExportActions';
import { useWizardValidation } from './hooks/useWizardValidation';
import { useWizardDraftRecovery } from './hooks/useWizardDraftRecovery';
import { useWizardOperationError } from './hooks/useWizardOperationError';
import { useWizardInitialLoad } from './hooks/useWizardInitialLoad';
import { useSelectedClientDataLoad } from './hooks/useSelectedClientDataLoad';
import { useGenerateDisputeLetters } from './hooks/useGenerateDisputeLetters';
import { useWizardKeyboardNavigation } from './hooks/useWizardKeyboardNavigation';
import { useWizardNavigation } from './hooks/useWizardNavigation';
import {
  type Client,
  type NegativeItem,
  type PersonalInfoItem,
  type InquiryItem,
  type ItemDisputeInstruction,
  type ReasonCode,
  type TriageQuickAction,
  type EvidenceDocument,
  type Methodology,
  type AIAnalysisResult,
  type AIAnalysisSummary,
  type GeneratedLetter,
  type ItemTab,
  type TargetRecipient,
  type GenerationMethod,
  type AnalysisAggressiveness,
  itemAppearsOnBureau,
} from './types';

interface WizardContextValue {
  currentStep: number;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  maxSteps: number;
  reviewStepId: number;

  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  selectedClient: Client | null;
  setSelectedClient: React.Dispatch<React.SetStateAction<Client | null>>;
  clientSearch: string;
  setClientSearch: React.Dispatch<React.SetStateAction<string>>;
  loadingClients: boolean;
  setLoadingClients: React.Dispatch<React.SetStateAction<boolean>>;

  negativeItems: NegativeItem[];
  setNegativeItems: React.Dispatch<React.SetStateAction<NegativeItem[]>>;
  selectedItems: string[];
  setSelectedItems: React.Dispatch<React.SetStateAction<string[]>>;
  personalInfoItems: PersonalInfoItem[];
  setPersonalInfoItems: React.Dispatch<React.SetStateAction<PersonalInfoItem[]>>;
  selectedPersonalItems: string[];
  setSelectedPersonalItems: React.Dispatch<React.SetStateAction<string[]>>;
  inquiryItems: InquiryItem[];
  setInquiryItems: React.Dispatch<React.SetStateAction<InquiryItem[]>>;
  selectedInquiryItems: string[];
  setSelectedInquiryItems: React.Dispatch<React.SetStateAction<string[]>>;
  activeTab: ItemTab;
  setActiveTab: React.Dispatch<React.SetStateAction<ItemTab>>;
  loadingItems: boolean;
  setLoadingItems: React.Dispatch<React.SetStateAction<boolean>>;
  itemDisputeInstructions: Map<string, ItemDisputeInstruction>;
  setItemDisputeInstructions: React.Dispatch<React.SetStateAction<Map<string, ItemDisputeInstruction>>>;

  disputeRound: number;
  setDisputeRound: React.Dispatch<React.SetStateAction<number>>;
  targetRecipient: TargetRecipient;
  setTargetRecipient: React.Dispatch<React.SetStateAction<TargetRecipient>>;
  selectedBureaus: string[];
  setSelectedBureaus: React.Dispatch<React.SetStateAction<string[]>>;
  generationMethod: GenerationMethod;
  setGenerationMethod: React.Dispatch<React.SetStateAction<GenerationMethod>>;
  combineItemsPerBureau: boolean;
  setCombineItemsPerBureau: React.Dispatch<React.SetStateAction<boolean>>;
  requestManualReview: boolean;
  setRequestManualReview: React.Dispatch<React.SetStateAction<boolean>>;

  methodologies: Methodology[];
  setMethodologies: React.Dispatch<React.SetStateAction<Methodology[]>>;
  selectedMethodology: string;
  setSelectedMethodology: React.Dispatch<React.SetStateAction<string>>;
  recommendedMethodology: string | null;
  setRecommendedMethodology: React.Dispatch<React.SetStateAction<string | null>>;
  loadingMethodologies: boolean;
  setLoadingMethodologies: React.Dispatch<React.SetStateAction<boolean>>;

  aiAnalysisResults: AIAnalysisResult[];
  setAiAnalysisResults: React.Dispatch<React.SetStateAction<AIAnalysisResult[]>>;
  aiAnalysisSummary: AIAnalysisSummary | null;
  setAiAnalysisSummary: React.Dispatch<React.SetStateAction<AIAnalysisSummary | null>>;
  analyzingItems: boolean;
  setAnalyzingItems: React.Dispatch<React.SetStateAction<boolean>>;
  analysisProgress: number;
  setAnalysisProgress: React.Dispatch<React.SetStateAction<number>>;
  analysisTotalItems: number;
  setAnalysisTotalItems: React.Dispatch<React.SetStateAction<number>>;
  estimatedTimeRemaining: number | null;
  setEstimatedTimeRemaining: React.Dispatch<React.SetStateAction<number | null>>;
  autoSelecting: boolean;
  setAutoSelecting: React.Dispatch<React.SetStateAction<boolean>>;
  autoSelectSummary: string;
  setAutoSelectSummary: React.Dispatch<React.SetStateAction<string>>;
  confidenceThreshold: number;
  setConfidenceThreshold: React.Dispatch<React.SetStateAction<number>>;
  showLowConfidenceItems: boolean;
  setShowLowConfidenceItems: React.Dispatch<React.SetStateAction<boolean>>;
  failedAnalysisItems: Set<string>;
  setFailedAnalysisItems: React.Dispatch<React.SetStateAction<Set<string>>>;
  analysisRetryCount: number;
  setAnalysisRetryCount: React.Dispatch<React.SetStateAction<number>>;

  analysisAggressiveness: AnalysisAggressiveness;
  setAnalysisAggressiveness: React.Dispatch<React.SetStateAction<AnalysisAggressiveness>>;
  analysisPreferencesSaved: boolean;
  setAnalysisPreferencesSaved: React.Dispatch<React.SetStateAction<boolean>>;

  discrepancySummary: { total: number; highSeverity: number } | null;
  setDiscrepancySummary: React.Dispatch<React.SetStateAction<{ total: number; highSeverity: number } | null>>;
  loadingDiscrepancies: boolean;
  setLoadingDiscrepancies: React.Dispatch<React.SetStateAction<boolean>>;

  triageQuickActions: TriageQuickAction[];
  setTriageQuickActions: React.Dispatch<React.SetStateAction<TriageQuickAction[]>>;

  evidenceDocuments: EvidenceDocument[];
  setEvidenceDocuments: React.Dispatch<React.SetStateAction<EvidenceDocument[]>>;
  selectedEvidenceIds: string[];
  setSelectedEvidenceIds: React.Dispatch<React.SetStateAction<string[]>>;
  loadingEvidence: boolean;
  setLoadingEvidence: React.Dispatch<React.SetStateAction<boolean>>;
  evidenceOverrideConfirmed: boolean;
  setEvidenceOverrideConfirmed: React.Dispatch<React.SetStateAction<boolean>>;
  showEvidenceUploadModal: boolean;
  setShowEvidenceUploadModal: React.Dispatch<React.SetStateAction<boolean>>;

  validationErrors: Record<number, string[]>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<number, string[]>>>;
  validationWarnings: Record<number, string[]>;
  setValidationWarnings: React.Dispatch<React.SetStateAction<Record<number, string[]>>>;
  evidenceBlockingStatus: EvidenceValidationResult | null;
  setEvidenceBlockingStatus: React.Dispatch<React.SetStateAction<EvidenceValidationResult | null>>;
  showEvidenceBlockingModal: boolean;
  setShowEvidenceBlockingModal: React.Dispatch<React.SetStateAction<boolean>>;

  operationError: string | null;
  setOperationError: React.Dispatch<React.SetStateAction<string | null>>;
  showErrorModal: boolean;
  setShowErrorModal: React.Dispatch<React.SetStateAction<boolean>>;

  showDraftRecovery: boolean;
  setShowDraftRecovery: React.Dispatch<React.SetStateAction<boolean>>;
  draftMetadata: DraftMetadata | null;
  setDraftMetadata: React.Dispatch<React.SetStateAction<DraftMetadata | null>>;

  selectedReasonCodes: string[];
  setSelectedReasonCodes: React.Dispatch<React.SetStateAction<string[]>>;
  selectedDisputeType: string;

  generatedLetters: GeneratedLetter[];
  setGeneratedLetters: React.Dispatch<React.SetStateAction<GeneratedLetter[]>>;
  generating: boolean;
  setGenerating: React.Dispatch<React.SetStateAction<boolean>>;
  generationProgress: number;
  setGenerationProgress: React.Dispatch<React.SetStateAction<number>>;

  bulkTrackingNumber: string;
  setBulkTrackingNumber: React.Dispatch<React.SetStateAction<string>>;
  bulkSendDate: string;
  setBulkSendDate: React.Dispatch<React.SetStateAction<string>>;
  markingAsSent: boolean;
  setMarkingAsSent: React.Dispatch<React.SetStateAction<boolean>>;
  bulkSentSuccess: boolean;
  setBulkSentSuccess: React.Dispatch<React.SetStateAction<boolean>>;

  fetchClients: () => void;
  fetchNegativeItems: (clientId: string) => Promise<void>;
  fetchDiscrepancies: (clientId: string) => Promise<void>;
  fetchTriage: (clientId: string) => Promise<void>;
  fetchEvidence: (clientId: string) => Promise<void>;
  fetchMethodologies: () => Promise<void>;
  fetchReasonCodes: (methodology?: string) => Promise<void>;
  analyzeItemsWithAI: (retryFailedOnly?: boolean) => Promise<{ analyses: AIAnalysisResult[]; summary: AIAnalysisSummary } | null>;
  autoSelectDisputableItems: () => Promise<void>;
  generateLetters: (analysisData?: { analyses: AIAnalysisResult[]; summary: AIAnalysisSummary } | null) => Promise<void>;
  handleSelectClient: (client: Client) => void;
  handleToggleItem: (itemId: string) => void;
  handleToggleBureau: (bureau: string) => void;
  handleUploadEvidence: (files: File[]) => Promise<void>;
  handleRemoveEvidence: (documentId: string) => Promise<void>;
  handleBulkMarkAsSent: () => Promise<void>;
  validateCurrentStep: () => boolean;
  canProceed: () => boolean;
  getStepValidation: (step: number) => { errors: string[]; warnings: string[] };
  updateItemInstruction: (itemId: string, instructionType: 'preset' | 'custom', value: string) => void;
  getInstructionText: (itemId: string) => string;
  copyToClipboard: (content: string) => void;
  downloadLetter: (content: string, filename: string) => void;
  buildStepStatuses: () => StepStatus[];
  handleStepClick: (stepId: number) => void;
  renderValidationMessages: () => React.ReactNode;
  saveAnalysisPreferences: () => Promise<void>;
  wizardDraft: ReturnType<typeof useWizardDraft>;
  reasonCodes: ReasonCode[];
  customReason: string;
}

const WizardContext = React.createContext<WizardContextValue | null>(null);

export function useWizardContext() {
  const ctx = React.useContext(WizardContext);
  if (!ctx) throw new Error('useWizardContext must be used within WizardProvider');
  return ctx;
}

export function WizardProvider({ children }: { children: React.ReactNode }) {
  const {
    currentStep,
    setCurrentStep,
    maxSteps,
    reviewStepId,
    handleStepClick,
  } = useWizardNavigation();

  const {
    clients,
    setClients,
    selectedClient,
    setSelectedClient,
    clientSearch,
    setClientSearch,
    loadingClients,
    setLoadingClients,
    fetchClients,
  } = useWizardClients();

  const {
    itemDisputeInstructions,
    setItemDisputeInstructions,
    updateItemInstruction,
    getInstructionText,
    hasItemInstruction,
  } = useItemDisputeInstructions();

  const {
    disputeRound,
    setDisputeRound,
    targetRecipient,
    setTargetRecipient,
    selectedBureaus,
    setSelectedBureaus,
    generationMethod,
    setGenerationMethod,
    combineItemsPerBureau,
    setCombineItemsPerBureau,
    requestManualReview,
    setRequestManualReview,
    selectedReasonCodes,
    setSelectedReasonCodes,
    selectedDisputeType,
    customReason,
    handleToggleBureau,
  } = useDisputeWizardOptions();

  const [confidenceThreshold, setConfidenceThreshold] = React.useState(0.5);
  const [showLowConfidenceItems, setShowLowConfidenceItems] = React.useState(false);

  const getGenerationMethodForItems = React.useCallback(() => generationMethod, [generationMethod]);
  const {
    negativeItems,
    setNegativeItems,
    selectedItems,
    setSelectedItems,
    personalInfoItems,
    setPersonalInfoItems,
    selectedPersonalItems,
    setSelectedPersonalItems,
    inquiryItems,
    setInquiryItems,
    selectedInquiryItems,
    setSelectedInquiryItems,
    activeTab,
    setActiveTab,
    loadingItems,
    setLoadingItems,
    fetchNegativeItems,
    handleSelectClient,
    handleToggleItem,
  } = useDisputeItems({
    getGenerationMethod: getGenerationMethodForItems,
    setSelectedClient,
    setItemDisputeInstructions,
  });

  const getDisputeRoundForIntelligence = React.useCallback(() => disputeRound, [disputeRound]);
  const {
    discrepancySummary,
    setDiscrepancySummary,
    loadingDiscrepancies,
    setLoadingDiscrepancies,
    triageQuickActions,
    setTriageQuickActions,
    fetchDiscrepancies,
    fetchTriage,
  } = useDisputeIntelligence({ getDisputeRound: getDisputeRoundForIntelligence });

  const {
    methodologies,
    setMethodologies,
    selectedMethodology,
    setSelectedMethodology,
    recommendedMethodology,
    setRecommendedMethodology,
    loadingMethodologies,
    setLoadingMethodologies,
    reasonCodes,
    fetchReasonCodes,
    fetchMethodologies,
  } = useDisputeMethodologies({ selectedItems, negativeItems, disputeRound });

  const {
    generatedLetters,
    setGeneratedLetters,
    generating,
    setGenerating,
    generationProgress,
    setGenerationProgress,
    generateLettersFromPlan,
  } = useLetterGeneration();

  const {
    operationError,
    setOperationError,
    showErrorModal,
    setShowErrorModal,
    showOperationError,
  } = useWizardOperationError();

  const getSelectedItemsForAnalysis = React.useCallback(() => selectedItems, [selectedItems]);
  const getDisputeRoundForAnalysis = React.useCallback(() => disputeRound, [disputeRound]);
  const handleRecommendedMethodology = React.useCallback((methodology: string) => {
    setSelectedMethodology(methodology);
  }, [setSelectedMethodology]);

  const {
    aiAnalysisResults,
    setAiAnalysisResults,
    aiAnalysisSummary,
    setAiAnalysisSummary,
    analyzingItems,
    setAnalyzingItems,
    analysisProgress,
    setAnalysisProgress,
    analysisTotalItems,
    setAnalysisTotalItems,
    estimatedTimeRemaining,
    setEstimatedTimeRemaining,
    failedAnalysisItems,
    setFailedAnalysisItems,
    analysisRetryCount,
    setAnalysisRetryCount,
    analysisAggressiveness,
    setAnalysisAggressiveness,
    analysisPreferencesSaved,
    setAnalysisPreferencesSaved,
    analyzeItemsWithAI,
    saveAnalysisPreferences,
  } = useAIAnalysis({
    getSelectedItems: getSelectedItemsForAnalysis,
    getDisputeRound: getDisputeRoundForAnalysis,
    onRecommendedMethodology: handleRecommendedMethodology,
    onOperationError: showOperationError,
  });

  const getClientIdForAutoSelection = React.useCallback(() => selectedClient?.id, [selectedClient]);
  const getDisputeRoundForAutoSelection = React.useCallback(() => disputeRound, [disputeRound]);
  const getGenerationMethodForAutoSelection = React.useCallback(() => generationMethod, [generationMethod]);
  const getNegativeItemCountForAutoSelection = React.useCallback(() => negativeItems.length, [negativeItems.length]);

  const {
    autoSelecting,
    setAutoSelecting,
    autoSelectSummary,
    setAutoSelectSummary,
    autoSelectDisputableItems,
  } = useDisputeAutoSelection({
    getClientId: getClientIdForAutoSelection,
    getDisputeRound: getDisputeRoundForAutoSelection,
    getGenerationMethod: getGenerationMethodForAutoSelection,
    getNegativeItemCount: getNegativeItemCountForAutoSelection,
    setSelectedItems,
    setItemDisputeInstructions,
    setSelectedMethodology,
    setRecommendedMethodology,
    setSelectedReasonCodes,
    setAiAnalysisResults,
    setAiAnalysisSummary,
  });

  const {
    evidenceDocuments,
    setEvidenceDocuments,
    selectedEvidenceIds,
    setSelectedEvidenceIds,
    loadingEvidence,
    setLoadingEvidence,
    evidenceOverrideConfirmed,
    setEvidenceOverrideConfirmed,
    showEvidenceUploadModal,
    setShowEvidenceUploadModal,
    fetchEvidence,
    handleUploadEvidence,
    handleRemoveEvidence,
  } = useEvidenceSelection({
    getClientId: () => selectedClient?.id,
    onOperationError: showOperationError,
  });

  const {
    showDraftRecovery,
    setShowDraftRecovery,
    draftMetadata,
    setDraftMetadata,
    wizardDraft,
  } = useWizardDraftRecovery({
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
  });

  const getSelectedClientForSubmission = React.useCallback(() => selectedClient, [selectedClient]);
  const getGeneratedLettersForSubmission = React.useCallback(() => generatedLetters, [generatedLetters]);
  const getNegativeItemsForSubmission = React.useCallback(() => negativeItems, [negativeItems]);
  const getSelectedReasonCodesForSubmission = React.useCallback(() => selectedReasonCodes, [selectedReasonCodes]);
  const getSelectedDisputeTypeForSubmission = React.useCallback(() => selectedDisputeType, [selectedDisputeType]);
  const getDisputeRoundForSubmission = React.useCallback(() => disputeRound, [disputeRound]);
  const getGenerationMethodForSubmission = React.useCallback(() => generationMethod, [generationMethod]);
  const getAiAnalysisSummaryForSubmission = React.useCallback(() => aiAnalysisSummary, [aiAnalysisSummary]);
  const getAutoSelectSummaryForSubmission = React.useCallback(() => autoSelectSummary, [autoSelectSummary]);
  const getTargetRecipientForSubmission = React.useCallback(() => targetRecipient, [targetRecipient]);
  const {
    bulkTrackingNumber,
    setBulkTrackingNumber,
    bulkSendDate,
    setBulkSendDate,
    markingAsSent,
    setMarkingAsSent,
    bulkSentSuccess,
    setBulkSentSuccess,
    handleBulkMarkAsSent,
  } = useBulkDisputeSubmission({
    getSelectedClient: getSelectedClientForSubmission,
    getGeneratedLetters: getGeneratedLettersForSubmission,
    getNegativeItems: getNegativeItemsForSubmission,
    getSelectedReasonCodes: getSelectedReasonCodesForSubmission,
    getSelectedDisputeType: getSelectedDisputeTypeForSubmission,
    getDisputeRound: getDisputeRoundForSubmission,
    getGenerationMethod: getGenerationMethodForSubmission,
    getAiAnalysisSummary: getAiAnalysisSummaryForSubmission,
    getAutoSelectSummary: getAutoSelectSummaryForSubmission,
    getTargetRecipient: getTargetRecipientForSubmission,
  });

  const {
    evidenceBlockingStatus,
    setEvidenceBlockingStatus,
    showEvidenceBlockingModal,
    setShowEvidenceBlockingModal,
    generateLetters,
  } = useGenerateDisputeLetters({
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
  });

  const { copyToClipboard, downloadLetter } = useLetterExportActions();
  const {
    validationErrors,
    setValidationErrors,
    validationWarnings,
    setValidationWarnings,
    getStepValidation,
    validateCurrentStep,
    canProceed,
    renderValidationMessages,
    buildStepStatuses,
  } = useWizardValidation({
    currentStep,
    selectedClient,
    selectedItems,
    selectedPersonalItems,
    selectedInquiryItems,
    generationMethod,
    itemDisputeInstructions,
    selectedBureaus,
    disputeRound,
    discrepancySummary,
    generatedLetters,
  });

  useWizardInitialLoad({ fetchClients, fetchReasonCodes, fetchMethodologies });

  useSelectedClientDataLoad({
    selectedClientId: selectedClient?.id,
    fetchNegativeItems,
    fetchDiscrepancies,
    fetchTriage,
    fetchEvidence,
  });

  useWizardKeyboardNavigation({ currentStep, maxSteps, validationErrors, setCurrentStep });

  const value: WizardContextValue = {
    currentStep, setCurrentStep, maxSteps, reviewStepId,
    clients, setClients, selectedClient, setSelectedClient, clientSearch, setClientSearch, loadingClients, setLoadingClients,
    negativeItems, setNegativeItems, selectedItems, setSelectedItems, personalInfoItems, setPersonalInfoItems,
    selectedPersonalItems, setSelectedPersonalItems, inquiryItems, setInquiryItems, selectedInquiryItems, setSelectedInquiryItems,
    activeTab, setActiveTab, loadingItems, setLoadingItems, itemDisputeInstructions, setItemDisputeInstructions,
    disputeRound, setDisputeRound, targetRecipient, setTargetRecipient, selectedBureaus, setSelectedBureaus,
    generationMethod, setGenerationMethod, combineItemsPerBureau, setCombineItemsPerBureau, requestManualReview, setRequestManualReview,
    methodologies, setMethodologies, selectedMethodology, setSelectedMethodology, recommendedMethodology, setRecommendedMethodology, loadingMethodologies, setLoadingMethodologies,
    aiAnalysisResults, setAiAnalysisResults, aiAnalysisSummary, setAiAnalysisSummary, analyzingItems, setAnalyzingItems,
    analysisProgress, setAnalysisProgress, analysisTotalItems, setAnalysisTotalItems, estimatedTimeRemaining, setEstimatedTimeRemaining,
    autoSelecting, setAutoSelecting, autoSelectSummary, setAutoSelectSummary, confidenceThreshold, setConfidenceThreshold,
    showLowConfidenceItems, setShowLowConfidenceItems, failedAnalysisItems, setFailedAnalysisItems, analysisRetryCount, setAnalysisRetryCount,
    analysisAggressiveness, setAnalysisAggressiveness, analysisPreferencesSaved, setAnalysisPreferencesSaved,
    discrepancySummary, setDiscrepancySummary, loadingDiscrepancies, setLoadingDiscrepancies,
    triageQuickActions, setTriageQuickActions,
    evidenceDocuments, setEvidenceDocuments, selectedEvidenceIds, setSelectedEvidenceIds, loadingEvidence, setLoadingEvidence,
    evidenceOverrideConfirmed, setEvidenceOverrideConfirmed, showEvidenceUploadModal, setShowEvidenceUploadModal,
    validationErrors, setValidationErrors, validationWarnings, setValidationWarnings,
    evidenceBlockingStatus, setEvidenceBlockingStatus, showEvidenceBlockingModal, setShowEvidenceBlockingModal,
    operationError, setOperationError, showErrorModal, setShowErrorModal,
    showDraftRecovery, setShowDraftRecovery, draftMetadata, setDraftMetadata,
    selectedReasonCodes, setSelectedReasonCodes, selectedDisputeType,
    generatedLetters, setGeneratedLetters, generating, setGenerating, generationProgress, setGenerationProgress,
    bulkTrackingNumber, setBulkTrackingNumber, bulkSendDate, setBulkSendDate, markingAsSent, setMarkingAsSent, bulkSentSuccess, setBulkSentSuccess,
    fetchClients, fetchNegativeItems, fetchDiscrepancies, fetchTriage, fetchEvidence, fetchMethodologies, fetchReasonCodes,
    analyzeItemsWithAI, autoSelectDisputableItems, generateLetters, handleSelectClient, handleToggleItem, handleToggleBureau,
    handleUploadEvidence, handleRemoveEvidence, handleBulkMarkAsSent,
    validateCurrentStep, canProceed, getStepValidation, updateItemInstruction, getInstructionText, copyToClipboard, downloadLetter,
    buildStepStatuses, handleStepClick, renderValidationMessages, saveAnalysisPreferences, wizardDraft, reasonCodes, customReason,
  };

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

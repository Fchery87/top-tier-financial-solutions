'use client';

import * as React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import {
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
  validateEvidenceRequirements,
  type ValidationResult,
  type EvidenceValidationResult,
} from '@/lib/dispute-wizard-validation';
import { type LetterStrengthScore } from '@/lib/letter-strength-calculator';
import { useWizardDraft, hasDraft, getDraftMetadata, type WizardDraftData, type DraftMetadata } from '@/hooks/useWizardDraft';
import { toast } from 'sonner';
import { type StepStatus } from '@/components/admin/DisputeWizardProgressBar';
import {
  type Client,
  type NegativeItem,
  type PersonalInfoItem,
  type InquiryItem,
  type ItemDisputeInstruction,
  type ReasonCode,
  type DisputeType,
  type TriageQuickAction,
  type EvidenceDocument,
  type Methodology,
  type AIAnalysisResult,
  type AIAnalysisSummary,
  type DisputeItemKind,
  type DisputeItemPayload,
  type GeneratedLetter,
  type ItemTab,
  type TargetRecipient,
  type GenerationMethod,
  type AnalysisAggressiveness,
  WIZARD_STEPS,
  PRESET_DISPUTE_INSTRUCTIONS,
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
  const [currentStep, setCurrentStep] = React.useState(1);
  const maxSteps = WIZARD_STEPS.length;
  const reviewStepId = 4;

  const [clients, setClients] = React.useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [clientSearch, setClientSearch] = React.useState('');
  const [loadingClients, setLoadingClients] = React.useState(false);

  const [negativeItems, setNegativeItems] = React.useState<NegativeItem[]>([]);
  const [selectedItems, setSelectedItems] = React.useState<string[]>([]);
  const [personalInfoItems, setPersonalInfoItems] = React.useState<PersonalInfoItem[]>([]);
  const [selectedPersonalItems, setSelectedPersonalItems] = React.useState<string[]>([]);
  const [inquiryItems, setInquiryItems] = React.useState<InquiryItem[]>([]);
  const [selectedInquiryItems, setSelectedInquiryItems] = React.useState<string[]>([]);
  const [activeTab, setActiveTab] = React.useState<ItemTab>('tradelines');
  const [loadingItems, setLoadingItems] = React.useState(false);
  const [itemDisputeInstructions, setItemDisputeInstructions] = React.useState<Map<string, ItemDisputeInstruction>>(new Map());

  const [disputeRound, setDisputeRound] = React.useState(1);
  const [targetRecipient, setTargetRecipient] = React.useState<TargetRecipient>('bureau');
  const [selectedBureaus, setSelectedBureaus] = React.useState<string[]>(['transunion', 'experian', 'equifax']);
  const [generationMethod, setGenerationMethod] = React.useState<GenerationMethod>('ai');
  const [combineItemsPerBureau, setCombineItemsPerBureau] = React.useState(true);
  const [requestManualReview, setRequestManualReview] = React.useState(false);

  const [methodologies, setMethodologies] = React.useState<Methodology[]>([]);
  const [selectedMethodology, setSelectedMethodology] = React.useState<string>('factual');
  const [recommendedMethodology, setRecommendedMethodology] = React.useState<string | null>(null);
  const [loadingMethodologies, setLoadingMethodologies] = React.useState(false);

  const [aiAnalysisResults, setAiAnalysisResults] = React.useState<AIAnalysisResult[]>([]);
  const [aiAnalysisSummary, setAiAnalysisSummary] = React.useState<AIAnalysisSummary | null>(null);
  const [analyzingItems, setAnalyzingItems] = React.useState(false);
  const [analysisProgress, setAnalysisProgress] = React.useState(0);
  const [analysisTotalItems, setAnalysisTotalItems] = React.useState(0);
  const [_analysisStartTime, setAnalysisStartTime] = React.useState<number | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = React.useState<number | null>(null);
  const [autoSelecting, setAutoSelecting] = React.useState(false);
  const [autoSelectSummary, setAutoSelectSummary] = React.useState('');
  const [confidenceThreshold, setConfidenceThreshold] = React.useState(0.5);
  const [showLowConfidenceItems, setShowLowConfidenceItems] = React.useState(false);
  const [failedAnalysisItems, setFailedAnalysisItems] = React.useState<Set<string>>(new Set());
  const [analysisRetryCount, setAnalysisRetryCount] = React.useState(0);
  const [_showRetryButton, setShowRetryButton] = React.useState(false);

  const [analysisAggressiveness, setAnalysisAggressiveness] = React.useState<AnalysisAggressiveness>('balanced');
  const [analysisPreferencesSaved, setAnalysisPreferencesSaved] = React.useState(false);

  const [discrepancySummary, setDiscrepancySummary] = React.useState<{ total: number; highSeverity: number } | null>(null);
  const [loadingDiscrepancies, setLoadingDiscrepancies] = React.useState(false);

  const [triageQuickActions, setTriageQuickActions] = React.useState<TriageQuickAction[]>([]);
  const [_loadingTriage, setLoadingTriage] = React.useState(false);

  const [evidenceDocuments, setEvidenceDocuments] = React.useState<EvidenceDocument[]>([]);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = React.useState<string[]>([]);
  const [loadingEvidence, setLoadingEvidence] = React.useState(false);
  const [evidenceOverrideConfirmed, setEvidenceOverrideConfirmed] = React.useState(false);
  const [showEvidenceUploadModal, setShowEvidenceUploadModal] = React.useState(false);

  const [validationErrors, setValidationErrors] = React.useState<Record<number, string[]>>({});
  const [validationWarnings, setValidationWarnings] = React.useState<Record<number, string[]>>({});
  const [evidenceBlockingStatus, setEvidenceBlockingStatus] = React.useState<EvidenceValidationResult | null>(null);
  const [showEvidenceBlockingModal, setShowEvidenceBlockingModal] = React.useState(false);

  const [operationError, setOperationError] = React.useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = React.useState(false);

  const [showDraftRecovery, setShowDraftRecovery] = React.useState(false);
  const [draftMetadata, setDraftMetadata] = React.useState<DraftMetadata | null>(null);

  const [reasonCodes, setReasonCodes] = React.useState<ReasonCode[]>([]);
  const [_disputeTypes, setDisputeTypes] = React.useState<DisputeType[]>([]);
  const [selectedReasonCodes, setSelectedReasonCodes] = React.useState<string[]>([]);
  const [selectedDisputeType, _setSelectedDisputeType] = React.useState('standard');
  const [customReason, _setCustomReason] = React.useState('');

  const [generatedLetters, setGeneratedLetters] = React.useState<GeneratedLetter[]>([]);
  const [generating, setGenerating] = React.useState(false);
  const [generationProgress, setGenerationProgress] = React.useState(0);

  const [bulkTrackingNumber, setBulkTrackingNumber] = React.useState('');
  const [bulkSendDate, setBulkSendDate] = React.useState('');
  const [markingAsSent, setMarkingAsSent] = React.useState(false);
  const [bulkSentSuccess, setBulkSentSuccess] = React.useState(false);

  const [_letterStrengthScore, _setLetterStrengthScore] = React.useState<LetterStrengthScore | null>(null);

  const wizardDraft = useWizardDraft(selectedClient?.id);

  const fetchClientsFn = React.useCallback(async () => {
    setLoadingClients(true);
    try {
      const searchParam = clientSearch ? `&search=${encodeURIComponent(clientSearch)}` : '';
      const response = await fetch(`/api/admin/clients?page=1&limit=50&status=active${searchParam}`);
      if (response.ok) {
        const data = await response.json();
        setClients(data.items);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoadingClients(false);
    }
  }, [clientSearch]);

  const fetchNegativeItems = async (clientId: string) => {
    setLoadingItems(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setNegativeItems(data.negative_items || []);
        setSelectedItems([]);
        setPersonalInfoItems(data.personal_info_disputes || []);
        setInquiryItems(data.inquiry_disputes || []);
        setSelectedPersonalItems([]);
        setSelectedInquiryItems([]);
        setAutoSelectSummary('');
      }
    } catch (error) {
      console.error('Error fetching negative items:', error);
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchDiscrepancies = async (clientId: string) => {
    setLoadingDiscrepancies(true);
    try {
      const response = await fetch(`/api/admin/disputes/discrepancies?clientId=${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setDiscrepancySummary({ total: data.summary?.total ?? 0, highSeverity: data.summary?.highSeverity ?? 0 });
      } else {
        setDiscrepancySummary(null);
      }
    } catch (error) {
      console.error('Error fetching discrepancies:', error);
      setDiscrepancySummary(null);
    } finally {
      setLoadingDiscrepancies(false);
    }
  };

  const fetchTriage = async (clientId: string) => {
    setLoadingTriage(true);
    try {
      const response = await fetch('/api/admin/disputes/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, round: disputeRound }),
      });
      if (response.ok) {
        const data = await response.json();
        setTriageQuickActions(data.quickActions || []);
      }
    } catch (error) {
      console.error('Error fetching triage:', error);
    } finally {
      setLoadingTriage(false);
    }
  };

  const fetchEvidence = async (clientId: string) => {
    setLoadingEvidence(true);
    try {
      const response = await fetch(`/api/admin/disputes/evidence?clientId=${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setEvidenceDocuments(data.documents || []);
      }
    } catch (error) {
      console.error('Error fetching evidence:', error);
    } finally {
      setLoadingEvidence(false);
    }
  };

  const fetchReasonCodes = async (methodology?: string) => {
    try {
      const url = methodology ? `/api/admin/disputes/methodologies?methodology=${methodology}` : '/api/admin/disputes/generate-letter';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setReasonCodes(data.reason_codes || []);
        if (data.dispute_types) setDisputeTypes(data.dispute_types || []);
      }
    } catch (error) {
      console.error('Error fetching reason codes:', error);
    }
  };

  const fetchMethodologies = async () => {
    setLoadingMethodologies(true);
    try {
      const response = await fetch('/api/admin/disputes/methodologies');
      if (response.ok) {
        const data = await response.json();
        setMethodologies(data.methodologies || []);
        if (data.reason_codes && data.reason_codes.length > 0) setReasonCodes(data.reason_codes);
      }
    } catch (error) {
      console.error('Error fetching methodologies:', error);
    } finally {
      setLoadingMethodologies(false);
    }
  };

  const retryWithBackoff = async <T,>(fn: () => Promise<T>, maxRetries: number = 3, onRetry?: (attempt: number, error: Error) => void): Promise<T | null> => {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Attempt ${attempt} failed:`, lastError.message);
        if (onRetry) onRetry(attempt, lastError);
        if (attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt) * 500;
          console.log(`Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }
    console.error('All retry attempts failed:', lastError?.message);
    return null;
  };

  const saveAnalysisPreferences = async () => {
    try {
      const preferences = { aggressiveness: analysisAggressiveness, savedAt: new Date().toISOString() };
      localStorage.setItem('dispute-analysis-preferences', JSON.stringify(preferences));
      setAnalysisPreferencesSaved(true);
      setTimeout(() => setAnalysisPreferencesSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save analysis preferences:', error);
    }
  };

  const analysisStartTimeRef = React.useRef<number | null>(null);

  const analyzeItemsWithAI = async (retryFailedOnly: boolean = false): Promise<{ analyses: AIAnalysisResult[]; summary: AIAnalysisSummary } | null> => {
    const itemsToAnalyze = retryFailedOnly ? Array.from(failedAnalysisItems) : selectedItems;
    if (itemsToAnalyze.length === 0) return null;

    setAnalyzingItems(true);
    setAnalysisTotalItems(itemsToAnalyze.length);
    setAnalysisProgress(0);
    analysisStartTimeRef.current = Date.now();
    setAnalysisStartTime(Date.now());
    setEstimatedTimeRemaining(null);
    setOperationError(null);
    setShowRetryButton(false);

    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => {
        const nextProgress = Math.min((prev as number) + Math.random() * 15, 85);
        if (analysisStartTimeRef.current) {
          const elapsedSeconds = (Date.now() - analysisStartTimeRef.current) / 1000;
          const estimatedTotalSeconds = (elapsedSeconds / (nextProgress / 100)) * 1.1;
          setEstimatedTimeRemaining(Math.max(0, Math.ceil(estimatedTotalSeconds - elapsedSeconds)));
        }
        return nextProgress;
      });
    }, 400);

    try {
      const data = await retryWithBackoff(
        async () => {
          const response = await fetch('/api/admin/disputes/analyze-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemIds: itemsToAnalyze, round: disputeRound, aggressiveness: analysisAggressiveness }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
          return response.json();
        },
        3,
        (attempt) => console.log(`Analysis retry attempt ${attempt}/3...`)
      );

      clearInterval(progressInterval);

      if (data) {
        const analyses = data.analyses || [];
        const summary = data.summary || null;

        if (retryFailedOnly) {
          setFailedAnalysisItems(new Set());
          setAnalysisRetryCount(0);
        }

        if (retryFailedOnly && aiAnalysisResults.length > 0) {
          const mergedAnalyses = aiAnalysisResults.map(existing => {
            const updated = analyses.find((a: AIAnalysisResult) => a.itemId === existing.itemId);
            return updated || existing;
          });
          setAiAnalysisResults(mergedAnalyses);
          if (summary) setAiAnalysisSummary({ ...summary, itemCount: mergedAnalyses.length });
        } else {
          setAiAnalysisResults(analyses);
          setAiAnalysisSummary(summary);
        }

        setAnalysisProgress(100);
        setEstimatedTimeRemaining(0);
        if (summary?.recommendedMethodology) setSelectedMethodology(summary.recommendedMethodology);

        return retryFailedOnly && aiAnalysisSummary ? { analyses: aiAnalysisResults, summary: aiAnalysisSummary } : { analyses, summary };
      } else {
        throw new Error('Analysis failed after 3 retry attempts');
      }
    } catch (error) {
      clearInterval(progressInterval);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error analyzing items:', errorMessage);

      const failedSet = new Set(failedAnalysisItems);
      itemsToAnalyze.forEach(id => failedSet.add(id));
      setFailedAnalysisItems(failedSet);
      setAnalysisRetryCount(prev => prev + 1);
      setShowRetryButton(true);

      let userMessage = 'Failed to analyze ';
      userMessage += retryFailedOnly ? `${failedSet.size} item(s) after ${analysisRetryCount + 1} retry attempt(s). ` : 'items. ';
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) userMessage += 'Please check your internet connection and try again.';
      else if (errorMessage.includes('408') || errorMessage.includes('504') || errorMessage.includes('timeout')) userMessage += 'Request timed out. Try with fewer items or retry failed items.';
      else userMessage += 'Please try again or contact support if the problem persists.';

      setOperationError(userMessage);
      setShowErrorModal(true);
      return null;
    } finally {
      setAnalyzingItems(false);
      setAnalysisProgress(0);
      setAnalysisTotalItems(0);
      setAnalysisStartTime(null);
      analysisStartTimeRef.current = null;
      clearInterval(progressInterval);
    }
  };

  const autoSelectDisputableItems = async () => {
    if (!selectedClient) return;
    setAutoSelecting(true);
    setAutoSelectSummary('');
    try {
      const response = await fetch('/api/admin/disputes/auto-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClient.id, round: disputeRound }),
      });
      if (!response.ok) { toast.error('Failed to auto-select disputable items'); return; }

      const data = await response.json();
      const recommendedIds: string[] = data.recommended_item_ids || [];
      setSelectedItems(recommendedIds);

      if (generationMethod === 'template') {
        setItemDisputeInstructions(prev => {
          const newMap = new Map(prev);
          recommendedIds.forEach(id => { if (!newMap.has(id)) newMap.set(id, { itemId: id, instructionType: 'preset', presetCode: '' }); });
          return newMap;
        });
      }
      if (data.summary?.recommendedMethodology) { setSelectedMethodology(data.summary.recommendedMethodology); setRecommendedMethodology(data.summary.recommendedMethodology); }
      if (data.summary?.recommendedReasonCodes) setSelectedReasonCodes(data.summary.recommendedReasonCodes);

      setAiAnalysisResults(data.analyses || []);
      setAiAnalysisSummary(data.summary ? {
        itemCount: data.summary.itemCount ?? recommendedIds.length,
        recommendedMethodology: data.summary.recommendedMethodology,
        allReasonCodes: data.summary.allReasonCodes ?? [],
        recommendedReasonCodes: data.summary.recommendedReasonCodes ?? [],
        averageConfidence: data.summary.averageConfidence ?? 0,
        allMetro2Violations: [],
        allFcraIssues: [],
        analysisNotes: '',
      } : null);
      setAutoSelectSummary(`Selected ${recommendedIds.length} of ${data.summary?.itemCount ?? negativeItems.length} disputable items (avg confidence ${data.summary?.averageConfidence ?? 0})`);
    } catch (error) {
      console.error('Error auto-selecting items:', error);
      toast.error('Error auto-selecting disputable items');
    } finally {
      setAutoSelecting(false);
    }
  };

  const getRecommendedMethodologyForItems = React.useCallback(() => {
    if (selectedItems.length === 0) return null;
    const hasCollection = negativeItems.filter(i => selectedItems.includes(i.id)).some(i => i.item_type === 'collection');
    if (hasCollection && disputeRound === 1) return 'debt_validation';
    if (disputeRound >= 2) return 'method_of_verification';
    return 'factual';
  }, [selectedItems, negativeItems, disputeRound]);

  const updateItemInstruction = (itemId: string, instructionType: 'preset' | 'custom', value: string) => {
    setItemDisputeInstructions(prev => {
      const newMap = new Map(prev);
      if (instructionType === 'preset') {
        newMap.set(itemId, { itemId, instructionType: value === 'custom' ? 'custom' : 'preset', presetCode: value, customText: value === 'custom' ? (prev.get(itemId)?.customText || '') : undefined });
      } else {
        newMap.set(itemId, { itemId, instructionType: 'custom', presetCode: 'custom', customText: value });
      }
      return newMap;
    });
  };

  const getInstructionText = (itemId: string): string => {
    const instruction = itemDisputeInstructions.get(itemId);
    if (!instruction) return '';
    if (instruction.instructionType === 'custom') return instruction.customText || '';
    const preset = PRESET_DISPUTE_INSTRUCTIONS.find(p => p.code === instruction.presetCode);
    return preset?.description || '';
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        setItemDisputeInstructions(prevInstructions => { const m = new Map(prevInstructions); m.delete(itemId); return m; });
        return prev.filter(id => id !== itemId);
      } else {
        if (generationMethod === 'template') {
          setItemDisputeInstructions(prevInstructions => { const m = new Map(prevInstructions); m.set(itemId, { itemId, instructionType: 'preset', presetCode: '' }); return m; });
        }
        return [...prev, itemId];
      }
    });
  };

  const generateLetters = async (analysisData?: { analyses: AIAnalysisResult[]; summary: AIAnalysisSummary } | null) => {
    if (!selectedClient) return;

    const usedReasonCodes = generationMethod === 'ai' ? (analysisData?.summary?.allReasonCodes || aiAnalysisSummary?.allReasonCodes || []) : selectedReasonCodes;
    const evidenceValidation = validateEvidenceRequirements(usedReasonCodes, selectedEvidenceIds, selectedItems);
    if (!evidenceValidation.isValid && !evidenceOverrideConfirmed) {
      setEvidenceBlockingStatus(evidenceValidation);
      setShowEvidenceBlockingModal(true);
      return;
    }

    const selectedTradelines = negativeItems.filter(i => selectedItems.includes(i.id));
    const selectedPersonal = personalInfoItems.filter(i => selectedPersonalItems.includes(i.id));
    const selectedInquiries = inquiryItems.filter(i => selectedInquiryItems.includes(i.id));

    const selectedDisputeItems: Array<{ kind: DisputeItemKind; raw: NegativeItem | PersonalInfoItem | InquiryItem; payload: DisputeItemPayload }> = [
      ...selectedTradelines.map(item => ({ kind: 'tradeline' as const, raw: item as NegativeItem | PersonalInfoItem | InquiryItem, payload: { id: item.id, kind: 'tradeline' as DisputeItemKind, bureau: item.bureau, creditorName: item.creditor_name, originalCreditor: item.original_creditor, accountNumber: item.account_number, itemType: item.item_type, amount: item.amount, riskSeverity: item.risk_severity } })),
      ...selectedPersonal.map(item => ({ kind: 'personal' as const, raw: item as NegativeItem | PersonalInfoItem | InquiryItem, payload: { id: item.id, kind: 'personal' as DisputeItemKind, bureau: item.bureau, itemType: `personal_info_${item.type}`, value: item.value } })),
      ...selectedInquiries.map(item => ({ kind: 'inquiry' as const, raw: item as NegativeItem | PersonalInfoItem | InquiryItem, payload: { id: item.id, kind: 'inquiry' as DisputeItemKind, bureau: item.bureau, creditorName: item.creditor_name, itemType: 'inquiry', inquiryDate: item.inquiry_date, inquiryType: item.inquiry_type, isPastFcraLimit: item.is_past_fcra_limit, daysSinceInquiry: item.days_since_inquiry } })),
    ];

    if (selectedDisputeItems.length === 0) return;

    const effectiveAnalyses = analysisData?.analyses || aiAnalysisResults;
    const effectiveSummary = analysisData?.summary || aiAnalysisSummary;

    const baseReasonCodes = generationMethod === 'ai' ? (effectiveSummary?.allReasonCodes || ['verification_required', 'inaccurate_reporting']) : [];
    const reasonCodeSet = new Set(baseReasonCodes);
    if (selectedPersonal.length > 0) { reasonCodeSet.add('verification_required'); reasonCodeSet.add('inaccurate_reporting'); }
    if (selectedInquiries.length > 0) { reasonCodeSet.add(selectedInquiries.some(i => i.is_past_fcra_limit) ? 'obsolete' : 'unauthorized_inquiry'); reasonCodeSet.add('verification_required'); }
    const reasonCodesToUse = Array.from(reasonCodeSet);

    setGenerating(true);
    setGenerationProgress(0);
    const letters: GeneratedLetter[] = [];

    const methodologyToUse = generationMethod === 'ai' ? (effectiveSummary?.recommendedMethodology || selectedMethodology) : selectedMethodology;
    const bureausToUse = targetRecipient === 'bureau' ? selectedBureaus : ['direct'];

    const perItemInstructions: Record<string, string> = {};
    if (generationMethod === 'template') {
      selectedItems.forEach(itemId => { const instruction = itemDisputeInstructions.get(itemId); if (instruction) perItemInstructions[itemId] = getInstructionText(itemId); });
    }

    const itemAppliesToBureau = (entry: { kind: DisputeItemKind; raw: NegativeItem | PersonalInfoItem | InquiryItem; payload: DisputeItemPayload }, bureau: string) => {
      if (entry.kind === 'tradeline') return itemAppearsOnBureau(entry.raw as NegativeItem, bureau);
      return !entry.payload.bureau || entry.payload.bureau.toLowerCase() === bureau.toLowerCase();
    };

    if (combineItemsPerBureau && targetRecipient === 'bureau') {
      const bureausWithItems = bureausToUse.filter(bureau => selectedDisputeItems.some(entry => itemAppliesToBureau(entry, bureau)));
      const totalLetters = bureausWithItems.length;
      let completed = 0;

      for (const bureau of bureausWithItems) {
        const itemsForThisBureau = selectedDisputeItems.filter(entry => itemAppliesToBureau(entry, bureau)).map(entry => entry.payload);
        try {
          const response = await fetch('/api/admin/disputes/generate-letter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: selectedClient.id, disputeItems: itemsForThisBureau, bureau, disputeType: selectedDisputeType, round: disputeRound,
              targetRecipient, reasonCodes: reasonCodesToUse, customReason: customReason || undefined, combineItems: true, methodology: methodologyToUse,
              perItemInstructions: generationMethod === 'template' ? perItemInstructions : undefined,
              metro2Violations: generationMethod === 'ai' ? effectiveSummary?.allMetro2Violations : undefined,
              evidenceDocumentIds: selectedEvidenceIds.length > 0 ? selectedEvidenceIds : undefined, requestManualReview,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            letters.push({ id: `letter-${bureau}-${itemsForThisBureau.map(i => i.id).join('-')}`, bureau, itemId: itemsForThisBureau[0]?.id || '', itemIds: itemsForThisBureau.map(i => i.id), items: itemsForThisBureau, content: data.letter_content, combined: true });
          }
        } catch (error) { console.error('Error generating combined letter:', error); }
        completed++;
        setGenerationProgress(totalLetters === 0 ? 0 : Math.round((completed / totalLetters) * 100));
      }
    } else {
      const itemBureauPairs = selectedDisputeItems.flatMap(entry => {
        if (targetRecipient !== 'bureau') return [{ entry, bureau: entry.payload.bureau || 'transunion' }];
        return bureausToUse.filter(bureau => itemAppliesToBureau(entry, bureau)).map(bureau => ({ entry, bureau }));
      });
      let completed = 0;
      const totalLetters = itemBureauPairs.length;

      for (const { entry, bureau } of itemBureauPairs) {
        const itemInstruction = generationMethod === 'template' && entry.kind === 'tradeline' ? getInstructionText(entry.payload.id) : customReason || undefined;
        try {
          const response = await fetch('/api/admin/disputes/generate-letter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: selectedClient.id, disputeItems: [entry.payload], bureau: targetRecipient === 'bureau' ? bureau : entry.payload.bureau || 'transunion',
              disputeType: selectedDisputeType, round: disputeRound, targetRecipient, reasonCodes: reasonCodesToUse, customReason: itemInstruction || undefined,
              creditorName: entry.payload.creditorName, itemType: entry.payload.itemType, amount: entry.payload.amount, methodology: methodologyToUse,
              disputeInstruction: itemInstruction,
              metro2Violations: generationMethod === 'ai' && entry.kind === 'tradeline' ? effectiveAnalyses.find(a => a.itemId === entry.payload.id)?.metro2Violations : undefined,
              evidenceDocumentIds: selectedEvidenceIds.length > 0 ? selectedEvidenceIds : undefined, requestManualReview,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            letters.push({ id: `letter-${bureau}-${entry.payload.id}`, bureau, itemId: entry.payload.id, itemKind: entry.kind, items: [entry.payload], content: data.letter_content, combined: false });
          }
        } catch (error) { console.error('Error generating letter:', error); }
        completed++;
        setGenerationProgress(totalLetters === 0 ? 0 : Math.round((completed / totalLetters) * 100));
      }
    }

    setGeneratedLetters(letters);
    setGenerating(false);
    setCurrentStep(reviewStepId);
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setSelectedItems([]);
    setSelectedPersonalItems([]);
    setSelectedInquiryItems([]);
    setNegativeItems([]);
    setPersonalInfoItems([]);
    setInquiryItems([]);
    setActiveTab('tradelines');
  };

  const handleToggleItem = (itemId: string) => toggleItemSelection(itemId);

  const handleToggleBureau = (bureau: string) => {
    setSelectedBureaus(prev => prev.includes(bureau) ? prev.filter(b => b !== bureau) : [...prev, bureau]);
  };

  const copyToClipboard = (content: string) => { navigator.clipboard.writeText(content); };

  const downloadLetter = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUploadEvidence = async (files: File[]) => {
    if (!selectedClient) return;
    const formData = new FormData();
    formData.append('clientId', selectedClient.id);
    files.forEach((file) => formData.append('files', file));
    try {
      const response = await fetch('/api/admin/disputes/evidence/upload', { method: 'POST', body: formData });
      if (response.ok) {
        const data = await response.json();
        const newDocuments = data.documents || [];
        setEvidenceDocuments((prev) => [...prev, ...newDocuments]);
        setSelectedEvidenceIds((prev) => [...prev, ...newDocuments.map((doc: EvidenceDocument) => doc.id)]);
        setShowEvidenceUploadModal(false);
      } else { throw new Error(await response.text() || 'Failed to upload evidence'); }
    } catch (error) {
      console.error('Error uploading evidence:', error);
      setOperationError(error instanceof Error ? error.message : 'Failed to upload evidence documents');
      setShowErrorModal(true);
    }
  };

  const handleRemoveEvidence = async (documentId: string) => {
    if (!selectedClient) return;
    try {
      const response = await fetch('/api/admin/disputes/evidence/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: selectedClient.id, documentId }) });
      if (response.ok) {
        setEvidenceDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
        setSelectedEvidenceIds((prev) => prev.filter((id) => id !== documentId));
      } else { throw new Error(await response.text() || 'Failed to remove evidence'); }
    } catch (error) {
      console.error('Error removing evidence:', error);
      setOperationError(error instanceof Error ? error.message : 'Failed to remove evidence document');
      setShowErrorModal(true);
    }
  };

  const handleBulkMarkAsSent = async () => {
    if (!selectedClient || generatedLetters.length === 0) return;
    setMarkingAsSent(true);
    setBulkSentSuccess(false);
    try {
      const sendDate = bulkSendDate ? new Date(bulkSendDate) : new Date();
      const responseDeadline = new Date(sendDate);
      responseDeadline.setDate(responseDeadline.getDate() + 30);

      for (const letter of generatedLetters) {
        const item = negativeItems.find(i => i.id === letter.itemId);
        const payload = letter.items?.[0];
        await fetch('/api/admin/disputes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: selectedClient.id, negativeItemId: letter.itemId, bureau: letter.bureau,
            disputeReason: selectedReasonCodes.join(', '), disputeType: selectedDisputeType, round: disputeRound,
            status: 'sent', letterContent: letter.content, trackingNumber: bulkTrackingNumber || null,
            sentAt: sendDate.toISOString(), responseDeadline: responseDeadline.toISOString(),
            creditorName: payload?.creditorName || item?.creditor_name,
            accountNumber: payload?.accountNumber || item?.account_number || null,
            generatedByAi: generationMethod === 'ai', reasonCodes: selectedReasonCodes,
            analysisConfidence: aiAnalysisSummary?.averageConfidence ? Math.round(aiAnalysisSummary.averageConfidence * 100) : undefined,
            autoSelected: !!autoSelectSummary, targetRecipient,
          }),
        });
      }
      setBulkSentSuccess(true);
    } catch (error) {
      console.error('Error marking disputes as sent:', error);
      toast.error('Failed to save some disputes. Please try again.');
    } finally {
      setMarkingAsSent(false);
    }
  };

  const getStepValidation = (step: number): { errors: string[]; warnings: string[] } => {
    let validationResult: ValidationResult | null = null;
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (step) {
      case 1: validationResult = validateStep1(selectedClient?.id ?? null); break;
      case 2: {
        validationResult = validateStep2(selectedItems, {});
        const totalSelected = selectedItems.length + selectedPersonalItems.length + selectedInquiryItems.length;
        if (totalSelected === 0) errors.push('Please select at least one item to dispute');
        if (generationMethod === 'template') {
          const missingInstructions = selectedItems.filter(itemId => {
            const instruction = itemDisputeInstructions.get(itemId);
            if (!instruction) return true;
            if (instruction.instructionType === 'preset' && instruction.presetCode && instruction.presetCode !== 'custom') return false;
            if (instruction.instructionType === 'custom' && instruction.customText && instruction.customText.trim().length > 0) return false;
            return true;
          });
          if (missingInstructions.length > 0) errors.push(`${missingInstructions.length} item(s) missing dispute instructions`);
        }
        break;
      }
      case 3:
        validationResult = validateStep3(selectedBureaus, disputeRound);
        if (discrepancySummary?.highSeverity && discrepancySummary.highSeverity > 0) errors.push('Unable to proceed with high-severity discrepancies detected');
        break;
      case 4: validationResult = validateStep4(generatedLetters); break;
    }

    if (validationResult) { errors.push(...validationResult.errors); warnings.push(...validationResult.warnings); }
    return { errors, warnings };
  };

  const validateCurrentStep = (): boolean => {
    const { errors, warnings } = getStepValidation(currentStep);
    const newErrors = { ...validationErrors };
    const newWarnings = { ...validationWarnings };
    if (errors.length > 0) newErrors[currentStep] = errors; else delete newErrors[currentStep];
    if (warnings.length > 0) newWarnings[currentStep] = warnings; else delete newWarnings[currentStep];
    setValidationErrors(newErrors);
    setValidationWarnings(newWarnings);
    return errors.length === 0;
  };

  const canProceed = (): boolean => getStepValidation(currentStep).errors.length === 0;

  const renderValidationMessages = () => {
    const errors = validationErrors[currentStep] || [];
    const warnings = validationWarnings[currentStep] || [];
    return (
      <>
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1"><h3 className="font-semibold text-red-900 mb-2">Validation Errors</h3><ul className="space-y-1">{errors.map((error, idx) => <li key={idx} className="text-red-800 text-sm">• {error}</li>)}</ul></div>
            </div>
          </div>
        )}
        {warnings.length > 0 && errors.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1"><h3 className="font-semibold text-yellow-900 mb-2">Warnings</h3><ul className="space-y-1">{warnings.map((warning, idx) => <li key={idx} className="text-yellow-800 text-sm">• {warning}</li>)}</ul></div>
            </div>
          </div>
        )}
      </>
    );
  };

  const buildStepStatuses = (): StepStatus[] => {
    return WIZARD_STEPS.map((step) => {
      const stepErrors = validationErrors[step.id] || [];
      const stepWarnings = validationWarnings[step.id] || [];
      const isComplete = (step.id === 1 && selectedClient !== null) || (step.id === 2 && selectedItems.length > 0) || (step.id === 3 && selectedBureaus.length > 0) || (step.id === 4 && generatedLetters.length > 0);
      return { stepId: step.id, isComplete, hasErrors: stepErrors.length > 0, hasWarnings: stepWarnings.length > 0, isCurrentStep: currentStep === step.id };
    });
  };

  const handleStepClick = (stepId: number) => { if (stepId < currentStep) setCurrentStep(stepId); };

  React.useEffect(() => { fetchClientsFn(); fetchReasonCodes(); fetchMethodologies(); if (hasDraft()) { setDraftMetadata(getDraftMetadata()); setShowDraftRecovery(true); } }, [fetchClientsFn]);

  React.useEffect(() => {
    const savedPreferences = localStorage.getItem('dispute-analysis-preferences');
    if (savedPreferences) { try { const prefs = JSON.parse(savedPreferences); if (prefs.aggressiveness) setAnalysisAggressiveness(prefs.aggressiveness); } catch (error) { console.error('Failed to load analysis preferences:', error); } }
  }, []);

  React.useEffect(() => {
    if (!selectedClient) return;
    const draftData: WizardDraftData = {
      selectedClientId: selectedClient.id, clientSearch, selectedItems, selectedPersonalItems, selectedInquiryItems, activeTab,
      itemDisputeInstructions, disputeRound, targetRecipient, selectedBureaus, generationMethod, combineItemsPerBureau,
      selectedMethodology, requestManualReview, selectedEvidenceIds, currentStep, selectedReasonCodes,
    };
    wizardDraft.setupAutoSave(draftData, { clientName: `${selectedClient.first_name} ${selectedClient.last_name}` });
    return () => {};
  }, [selectedClient, clientSearch, selectedItems, selectedPersonalItems, selectedInquiryItems, activeTab, itemDisputeInstructions, disputeRound, targetRecipient, selectedBureaus, generationMethod, combineItemsPerBureau, selectedMethodology, requestManualReview, selectedEvidenceIds, currentStep, selectedReasonCodes, wizardDraft]);

  React.useEffect(() => { const recommended = getRecommendedMethodologyForItems(); setRecommendedMethodology(recommended); }, [getRecommendedMethodologyForItems]);
  React.useEffect(() => { if (selectedMethodology) fetchReasonCodes(selectedMethodology); }, [selectedMethodology]);
  React.useEffect(() => { if (selectedClient) { fetchNegativeItems(selectedClient.id); fetchDiscrepancies(selectedClient.id); fetchTriage(selectedClient.id); fetchEvidence(selectedClient.id); } }, [selectedClient]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) { e.preventDefault(); if (currentStep < maxSteps) { const stepErrors = validationErrors[currentStep]; if (!stepErrors || stepErrors.length === 0) setCurrentStep(currentStep + 1); } }
      if (e.key === 'Escape' && currentStep > 1) { e.preventDefault(); setCurrentStep(currentStep - 1); }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => { window.removeEventListener('keydown', handleKeyPress); };
  }, [currentStep, maxSteps, validationErrors]);

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
    fetchClients: fetchClientsFn, fetchNegativeItems, fetchDiscrepancies, fetchTriage, fetchEvidence, fetchMethodologies, fetchReasonCodes,
    analyzeItemsWithAI, autoSelectDisputableItems, generateLetters, handleSelectClient, handleToggleItem, handleToggleBureau,
    handleUploadEvidence, handleRemoveEvidence, handleBulkMarkAsSent,
    validateCurrentStep, canProceed, getStepValidation, updateItemInstruction, getInstructionText, copyToClipboard, downloadLetter,
    buildStepStatuses, handleStepClick, renderValidationMessages, saveAnalysisPreferences, wizardDraft, reasonCodes, customReason,
  };

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

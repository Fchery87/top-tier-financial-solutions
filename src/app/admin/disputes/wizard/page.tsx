'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Users,
  FileText,
  Target,
  Sparkles,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Search,
  Check,
  Loader2,
  Copy,
  Download,
  AlertCircle,
  Zap,
  Paperclip,
  AlertTriangle,
  Upload,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
  validateEvidenceRequirements,
  type ValidationResult,
  type EvidenceValidationResult,
} from '@/lib/dispute-wizard-validation';
import { calculateLetterStrength, type LetterStrengthScore } from '@/lib/letter-strength-calculator';
import { useWizardDraft, hasDraft, getDraftMetadata, type WizardDraftData, type DraftMetadata } from '@/hooks/useWizardDraft';
import { DisputeWizardProgressBar, type StepStatus } from '@/components/admin/DisputeWizardProgressBar';
import { EvidenceUploadModal } from '@/components/admin/EvidenceUploadModal';

interface Client {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
}

interface NegativeItem {
  id: string;
  creditor_name: string;
  original_creditor: string | null;
  account_number?: string | null;
  item_type: string;
  amount: number | null;
  date_reported: string | null;
  bureau: string | null; // Legacy field
  // Per-bureau presence fields
  bureaus?: string[]; // Computed array: ['transunion', 'experian', 'equifax']
  on_transunion?: boolean;
  on_experian?: boolean;
  on_equifax?: boolean;
  transunion_date?: string | null;
  experian_date?: string | null;
  equifax_date?: string | null;
  transunion_status?: string | null;
  experian_status?: string | null;
  equifax_status?: string | null;
  risk_severity: string;
  recommended_action: string | null;
}

interface PersonalInfoItem {
  id: string;
  bureau: string;
  type: string;
  value: string;
}

interface InquiryItem {
  id: string;
  creditor_name: string;
  bureau: string | null;
  inquiry_date?: string | null;
  inquiry_type?: string | null;
  is_past_fcra_limit?: boolean | null;
  days_since_inquiry?: number | null;
}

// Per-item dispute instruction (set during item selection)
interface ItemDisputeInstruction {
  itemId: string;
  instructionType: 'preset' | 'custom';
  presetCode?: string;
  customText?: string;
}

interface ReasonCode {
  code: string;
  label: string;
  description: string;
  methodologyFit?: string[];
  strength?: string;
}

interface DisputeType {
  code: string;
  label: string;
}

interface TriageQuickAction {
  id: string;
  label: string;
  description: string;
  itemIds: string[];
  count: number;
  bureau?: string;
  itemType?: string;
}

interface EvidenceDocument {
  id: string;
  file_name: string;
  file_type: string;
  file_url: string;
  created_at: string;
}

interface Methodology {
  code: string;
  name: string;
  description: string;
  roundRange: number[];
  targetRecipients: string[];
  bestFor: string[];
  successIndicators: string[];
}

// Pre-built dispute instructions - PRIORITIZE METRO 2 COMPLIANCE-BASED FACTUAL DISPUTES
// IMPORTANT: Do NOT default to ownership denial claims (not_mine, identity_theft) 
// unless client specifically confirms those facts
const PRESET_DISPUTE_INSTRUCTIONS = [
  // === RECOMMENDED: METRO 2 COMPLIANCE-BASED FACTUAL DISPUTES ===
  { code: 'verification_required', label: '✓ Request Verification (Recommended)', description: 'I am requesting documented verification of this account data under FCRA Section 611. The furnisher must provide proof that this information is complete and accurate per Metro 2 standards.', category: 'factual' },
  { code: 'metro2_violation', label: '✓ Metro 2 Compliance Violation', description: 'This account contains Metro 2 format compliance violations and does not meet the maximum possible accuracy standard required under FCRA Section 607(b).', category: 'factual' },
  { code: 'inaccurate_reporting', label: '✓ Inaccurate Information', description: 'The information being reported contains inaccuracies. I am disputing the accuracy of this data under FCRA Section 623 and demanding a reasonable investigation.', category: 'factual' },
  { code: 'incomplete_data', label: '✓ Incomplete Data Fields', description: 'This account is being reported with incomplete information, missing required Metro 2 data fields necessary for accurate credit reporting.', category: 'factual' },
  { code: 'missing_dofd', label: '✓ Missing Date of First Delinquency', description: 'This derogatory account lacks the required Date of First Delinquency (DOFD) field, which is mandatory under FCRA Section 605 for calculating the 7-year reporting period.', category: 'factual' },
  { code: 'status_inconsistency', label: '✓ Status Code Inconsistency', description: 'The Account Status Code is inconsistent with the Payment Rating and payment history pattern. This internal data inconsistency violates Metro 2 format requirements.', category: 'factual' },
  
  // === SITUATIONAL: Use when specific conditions apply ===
  { code: 'wrong_balance', label: 'Incorrect Balance', description: 'The balance reported is incorrect and does not reflect the actual amount owed.', category: 'situational' },
  { code: 'paid_in_full', label: 'Paid in Full', description: 'This account has been paid in full but is still showing a balance or negative status.', category: 'situational' },
  { code: 'wrong_status', label: 'Wrong Account Status', description: 'The account status being reported is inaccurate and requires verification.', category: 'situational' },
  { code: 'wrong_dates', label: 'Incorrect Dates', description: 'The dates associated with this account are being reported incorrectly.', category: 'situational' },
  { code: 'duplicate', label: 'Duplicate Account', description: 'This account appears multiple times on my credit report.', category: 'situational' },
  { code: 'obsolete', label: 'Obsolete Information (7+ Years)', description: 'This information is obsolete and has exceeded the FCRA 7-year reporting period.', category: 'situational' },
  { code: 'settled', label: 'Account Settled', description: 'This account was settled but is not being reported correctly.', category: 'situational' },
  { code: 'included_bankruptcy', label: 'Included in Bankruptcy', description: 'This account was included in bankruptcy and should reflect discharged status.', category: 'situational' },
  { code: 'unauthorized_inquiry', label: 'Unauthorized Inquiry', description: 'This inquiry lacks documented permissible purpose under FCRA Section 604.', category: 'situational' },
  
  // === CAUTION: Only use when client specifically confirms these facts ===
  { code: 'not_mine', label: '⚠️ Not My Account (CLIENT MUST CONFIRM)', description: 'This account does not belong to me. I have never opened or authorized this account. WARNING: Only use if client confirms this is true.', category: 'ownership_claim' },
  { code: 'never_late', label: '⚠️ Never Late (CLIENT MUST CONFIRM)', description: 'I have never been late on this account. WARNING: Only use if client confirms all payments were on time.', category: 'ownership_claim' },
  { code: 'identity_theft', label: '⚠️ Identity Theft (REQUIRES DOCUMENTATION)', description: 'This account was opened fraudulently as a result of identity theft. WARNING: Should have police report or FTC Identity Theft Report.', category: 'ownership_claim' },
  
  { code: 'custom', label: 'Custom Instruction', description: 'Enter your own dispute instruction', category: 'custom' },
];

// Both modes now use 4 steps (Template mode no longer has separate Reason Codes step)
const WIZARD_STEPS = [
  { id: 1, name: 'Client', icon: Users },
  { id: 2, name: 'Items', icon: FileText },
  { id: 3, name: 'Configure', icon: Target },
  { id: 4, name: 'Review', icon: CheckCircle },
];

interface AIAnalysisResult {
  itemId: string;
  creditorName: string;
  itemType: string;
  suggestedMethodology: string;
  autoReasonCodes: string[];
  metro2Violations: string[];
  fcraIssues: string[];
  confidence: number;
  analysisNotes: string;
}

interface AIAnalysisSummary {
  itemCount: number;
  recommendedMethodology: string;
  allReasonCodes: string[];
   recommendedReasonCodes?: string[];
  allMetro2Violations: string[];
  allFcraIssues: string[];
  averageConfidence: number;
  analysisNotes: string;
}

const BUREAUS = [
  { code: 'transunion', label: 'TransUnion' },
  { code: 'experian', label: 'Experian' },
  { code: 'equifax', label: 'Equifax' },
];

type DisputeItemKind = 'tradeline' | 'personal' | 'inquiry';

interface DisputeItemPayload {
  id: string;
  kind: DisputeItemKind;
  bureau?: string | null;
  creditorName?: string;
  originalCreditor?: string | null;
  accountNumber?: string | null;
  itemType?: string;
  amount?: number | null;
  value?: string;
  inquiryDate?: string | null;
  inquiryType?: string | null;
  isPastFcraLimit?: boolean | null;
  daysSinceInquiry?: number | null;
  riskSeverity?: string | null;
}

// Helper function to check if a negative item appears on a specific bureau
// Uses the new per-bureau boolean fields, with fallback to legacy bureau field
function itemAppearsOnBureau(item: NegativeItem, bureau: string): boolean {
  const bureauLower = bureau.toLowerCase();
  
  // First, check the new per-bureau boolean fields
  if (bureauLower === 'transunion' && item.on_transunion !== undefined) {
    return item.on_transunion;
  }
  if (bureauLower === 'experian' && item.on_experian !== undefined) {
    return item.on_experian;
  }
  if (bureauLower === 'equifax' && item.on_equifax !== undefined) {
    return item.on_equifax;
  }
  
  // Check the bureaus array if available
  if (item.bureaus && item.bureaus.length > 0) {
    return item.bureaus.includes(bureauLower);
  }
  
  // Fallback to legacy bureau field logic
  // If no specific bureau, assume it appears on all bureaus (conservative)
  if (!item.bureau || item.bureau === 'combined') {
    return true;
  }
  
  // Otherwise, check if legacy bureau matches
  return item.bureau.toLowerCase() === bureauLower;
}

export default function DisputeWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(1);
  const [_loading, _setLoading] = React.useState(false);

  // Step 1 - Client Selection
  const [clients, setClients] = React.useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [clientSearch, setClientSearch] = React.useState('');
  const [loadingClients, setLoadingClients] = React.useState(false);

  // Step 2 - Item Selection
  const [negativeItems, setNegativeItems] = React.useState<NegativeItem[]>([]);
  const [selectedItems, setSelectedItems] = React.useState<string[]>([]);
  const [personalInfoItems, setPersonalInfoItems] = React.useState<PersonalInfoItem[]>([]);
  const [selectedPersonalItems, setSelectedPersonalItems] = React.useState<string[]>([]);
  const [inquiryItems, setInquiryItems] = React.useState<InquiryItem[]>([]);
  const [selectedInquiryItems, setSelectedInquiryItems] = React.useState<string[]>([]);
  const [activeTab, setActiveTab] = React.useState<'tradelines' | 'personal' | 'inquiries'>('tradelines');
  const [loadingItems, setLoadingItems] = React.useState(false);
  
  // Per-item dispute instructions (for template mode)
  const [itemDisputeInstructions, setItemDisputeInstructions] = React.useState<Map<string, ItemDisputeInstruction>>(new Map());

  // Step 3 - Round & Target
  const [disputeRound, setDisputeRound] = React.useState(1);
  const [targetRecipient, setTargetRecipient] = React.useState<'bureau' | 'creditor' | 'collector'>('bureau');
  const [selectedBureaus, setSelectedBureaus] = React.useState<string[]>(['transunion', 'experian', 'equifax']);
  const [generationMethod, setGenerationMethod] = React.useState<'ai' | 'template'>('ai');
  const [combineItemsPerBureau, setCombineItemsPerBureau] = React.useState(true);
  const [requestManualReview, setRequestManualReview] = React.useState(false); // e-OSCAR bypass option
  
  // NEW: Methodology Selection
  const [methodologies, setMethodologies] = React.useState<Methodology[]>([]);
  const [selectedMethodology, setSelectedMethodology] = React.useState<string>('factual');
  const [recommendedMethodology, setRecommendedMethodology] = React.useState<string | null>(null);
  const [loadingMethodologies, setLoadingMethodologies] = React.useState(false);

  // AI Analysis Results (used when generationMethod === 'ai')
  const [aiAnalysisResults, setAiAnalysisResults] = React.useState<AIAnalysisResult[]>([]);
  const [aiAnalysisSummary, setAiAnalysisSummary] = React.useState<AIAnalysisSummary | null>(null);
  const [analyzingItems, setAnalyzingItems] = React.useState(false);
  const [analysisProgress, setAnalysisProgress] = React.useState(0); // Current item index (0-based)
  const [analysisTotalItems, setAnalysisTotalItems] = React.useState(0); // Total items to analyze
  const [analysisStartTime, setAnalysisStartTime] = React.useState<number | null>(null); // Start timestamp
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = React.useState<number | null>(null); // Estimated seconds remaining
  const [autoSelecting, setAutoSelecting] = React.useState(false);
  const [autoSelectSummary, setAutoSelectSummary] = React.useState<string>('');
  const [confidenceThreshold, setConfidenceThreshold] = React.useState(0.5); // Confidence filter (0-1)
  const [showLowConfidenceItems, setShowLowConfidenceItems] = React.useState(false); // Toggle to show filtered items
  const [failedAnalysisItems, setFailedAnalysisItems] = React.useState<Set<string>>(new Set()); // Items that failed analysis
  const [analysisRetryCount, setAnalysisRetryCount] = React.useState<number>(0); // Number of retry attempts
  const [_showRetryButton, setShowRetryButton] = React.useState(false); // Show retry button when analysis fails

  // P3.4: Analysis customization preferences
  const [analysisAggressiveness, setAnalysisAggressiveness] = React.useState<'conservative' | 'balanced' | 'aggressive'>('balanced'); // Analysis intensity
  const [analysisPreferencesSaved, setAnalysisPreferencesSaved] = React.useState(false); // Show save confirmation

  // P3.6: Letter strength scoring
  const [_letterStrengthScore, _setLetterStrengthScore] = React.useState<LetterStrengthScore | null>(null);

  // Discrepancy preflight
  const [discrepancySummary, setDiscrepancySummary] = React.useState<{ total: number; highSeverity: number } | null>(null);
  const [loadingDiscrepancies, setLoadingDiscrepancies] = React.useState(false);

  // Triage quick actions
  const [triageQuickActions, setTriageQuickActions] = React.useState<TriageQuickAction[]>([]);
  const [_loadingTriage, setLoadingTriage] = React.useState(false);

  // Evidence documents
  const [evidenceDocuments, setEvidenceDocuments] = React.useState<EvidenceDocument[]>([]);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = React.useState<string[]>([]);
  const [loadingEvidence, setLoadingEvidence] = React.useState(false);
  const [evidenceOverrideConfirmed, setEvidenceOverrideConfirmed] = React.useState(false);
  const [showEvidenceUploadModal, setShowEvidenceUploadModal] = React.useState(false);

  // Validation state
  const [validationErrors, setValidationErrors] = React.useState<Record<number, string[]>>({});
  const [validationWarnings, setValidationWarnings] = React.useState<Record<number, string[]>>({});
  const [evidenceBlockingStatus, setEvidenceBlockingStatus] = React.useState<EvidenceValidationResult | null>(null);
  const [showEvidenceBlockingModal, setShowEvidenceBlockingModal] = React.useState(false);

  // Error recovery state
  const [operationError, setOperationError] = React.useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = React.useState(false);
  const [_failedLetterIds, _setFailedLetterIds] = React.useState<Set<string>>(new Set());
  const [_retryCount, _setRetryCount] = React.useState<Record<string, number>>({});

  // Draft persistence state
  const [showDraftRecovery, setShowDraftRecovery] = React.useState(false);
  const [draftMetadata, setDraftMetadata] = React.useState<DraftMetadata | null>(null);
  const wizardDraft = useWizardDraft(selectedClient?.id);

  // Both modes use 4 steps now
  const maxSteps = WIZARD_STEPS.length;
  const reviewStepId = 4;

  // Legacy reason codes state (kept for backward compatibility, but not used in new flow)
  const [_reasonCodes, setReasonCodes] = React.useState<ReasonCode[]>([]);
  const [_disputeTypes, setDisputeTypes] = React.useState<DisputeType[]>([]);
  const [selectedReasonCodes, setSelectedReasonCodes] = React.useState<string[]>([]);
  const [selectedDisputeType, _setSelectedDisputeType] = React.useState('standard');
  const [customReason, _setCustomReason] = React.useState('');

  // Step 5 - Generated Letters
  const [generatedLetters, setGeneratedLetters] = React.useState<Array<{
    id: string;
    bureau: string;
    itemId: string;
    itemIds?: string[]; // For combined letters
    items?: DisputeItemPayload[];
    itemKind?: DisputeItemKind;
    content: string;
    combined: boolean;
  }>>([]);
  const [generating, setGenerating] = React.useState(false);
  const [generationProgress, setGenerationProgress] = React.useState(0);

  // Bulk Mark as Sent
  const [bulkTrackingNumber, setBulkTrackingNumber] = React.useState('');
  const [bulkSendDate, setBulkSendDate] = React.useState('');
  const [markingAsSent, setMarkingAsSent] = React.useState(false);
  const [bulkSentSuccess, setBulkSentSuccess] = React.useState(false);

  // Fetch clients
  const fetchClients = React.useCallback(async () => {
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

  // Fetch negative items for selected client
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

  // Fetch discrepancies summary for preflight guardrails
  const fetchDiscrepancies = async (clientId: string) => {
    setLoadingDiscrepancies(true);
    try {
      const response = await fetch(`/api/admin/disputes/discrepancies?clientId=${clientId}`);
      if (response.ok) {
        const data = await response.json();
        setDiscrepancySummary({
          total: data.summary?.total ?? 0,
          highSeverity: data.summary?.highSeverity ?? 0,
        });
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

  // Fetch triage quick actions for the client
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

  // Fetch evidence documents for the client
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

  // Fetch reason codes and dispute types
  const fetchReasonCodes = async (methodology?: string) => {
    try {
      const url = methodology 
        ? `/api/admin/disputes/methodologies?methodology=${methodology}`
        : '/api/admin/disputes/generate-letter';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setReasonCodes(data.reason_codes || []);
        if (data.dispute_types) {
          setDisputeTypes(data.dispute_types || []);
        }
      }
    } catch (error) {
      console.error('Error fetching reason codes:', error);
    }
  };

  // Fetch methodologies
  const fetchMethodologies = async () => {
    setLoadingMethodologies(true);
    try {
      const response = await fetch('/api/admin/disputes/methodologies');
      if (response.ok) {
        const data = await response.json();
        setMethodologies(data.methodologies || []);
        // Also set reason codes from methodologies API
        if (data.reason_codes && data.reason_codes.length > 0) {
          setReasonCodes(data.reason_codes);
        }
      }
    } catch (error) {
      console.error('Error fetching methodologies:', error);
    } finally {
      setLoadingMethodologies(false);
    }
  };

  // Helper function for exponential backoff retry
  // Retries up to 3 times with exponential delay (1s, 3s, 7s)
  const retryWithBackoff = async <T,>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    onRetry?: (attempt: number, error: Error) => void
  ): Promise<T | null> => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Attempt ${attempt} failed:`, lastError.message);

        if (onRetry) {
          onRetry(attempt, lastError);
        }

        // Calculate exponential backoff delay
        if (attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt) * 500; // 1s, 2s, 4s
          console.log(`Retrying in ${delayMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    console.error('All retry attempts failed:', lastError?.message);
    return null;
  };

  // P3.4: Save analysis preferences to localStorage
  const saveAnalysisPreferences = async () => {
    try {
      const preferences = {
        aggressiveness: analysisAggressiveness,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('dispute-analysis-preferences', JSON.stringify(preferences));
      setAnalysisPreferencesSaved(true);

      // Reset confirmation message after 3 seconds
      setTimeout(() => setAnalysisPreferencesSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save analysis preferences:', error);
    }
  };

  // Analyze items with AI (auto-determine dispute strategy)
  // Returns the analysis data directly to avoid React state timing issues
  // Implements exponential backoff retry with graceful degradation
  const analyzeItemsWithAI = async (retryFailedOnly: boolean = false): Promise<{ analyses: AIAnalysisResult[]; summary: AIAnalysisSummary } | null> => {
    const itemsToAnalyze = retryFailedOnly ? Array.from(failedAnalysisItems) : selectedItems;

    if (itemsToAnalyze.length === 0) return null;

    setAnalyzingItems(true);
    setAnalysisTotalItems(itemsToAnalyze.length);
    setAnalysisProgress(0);
    setAnalysisStartTime(Date.now());
    setEstimatedTimeRemaining(null);
    setOperationError(null);
    setShowRetryButton(false);

    // Simulate progress updates while analysis is running
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => {
        // Increment progress but don't exceed 90% until API responds
        const nextProgress = Math.min(prev + Math.random() * 15, 85);

        // Calculate estimated time remaining
        if (analysisStartTime) {
          const elapsedMs = Date.now() - analysisStartTime;
          const elapsedSeconds = elapsedMs / 1000;
          const estimatedTotalSeconds = (elapsedSeconds / (nextProgress / 100)) * 1.1; // Add 10% buffer
          const remainingSeconds = Math.max(0, Math.ceil(estimatedTotalSeconds - elapsedSeconds));
          setEstimatedTimeRemaining(remainingSeconds);
        }

        return nextProgress as number;
      });
    }, 400); // Update every 400ms

    try {
      // Use retry wrapper with exponential backoff
      const data = await retryWithBackoff(
        async () => {
          const response = await fetch('/api/admin/disputes/analyze-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              itemIds: itemsToAnalyze,
              round: disputeRound,
              aggressiveness: analysisAggressiveness, // P3.5: Pass aggressiveness parameter
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
          }

          return response.json();
        },
        3, // Max 3 attempts
        (attempt) => {
          console.log(`Analysis retry attempt ${attempt}/3...`);
        }
      );

      clearInterval(progressInterval);

      if (data) {
        const analyses = data.analyses || [];
        const summary = data.summary || null;

        // Clear failed items if analysis succeeded
        if (retryFailedOnly) {
          setFailedAnalysisItems(new Set());
          setAnalysisRetryCount(0);
        }

        // Merge with existing results if retrying failed items
        if (retryFailedOnly && aiAnalysisResults.length > 0) {
          const mergedAnalyses = aiAnalysisResults.map(existing => {
            const updated = analyses.find((a: AIAnalysisResult) => a.itemId === existing.itemId);
            return updated || existing;
          });
          setAiAnalysisResults(mergedAnalyses);

          // Recalculate summary with merged data
          if (summary) {
            setAiAnalysisSummary({
              ...summary,
              itemCount: mergedAnalyses.length,
            });
          }
        } else {
          // Update state for UI display
          setAiAnalysisResults(analyses);
          setAiAnalysisSummary(summary);
        }

        setAnalysisProgress(100);
        setEstimatedTimeRemaining(0);

        // Auto-select the recommended methodology
        if (summary?.recommendedMethodology) {
          setSelectedMethodology(summary.recommendedMethodology);
        }

        // Return the data directly to avoid state timing issues
        return retryFailedOnly && aiAnalysisSummary ? { analyses: aiAnalysisResults, summary: aiAnalysisSummary } : { analyses, summary };
      } else {
        // All retries failed
        throw new Error('Analysis failed after 3 retry attempts');
      }
    } catch (error) {
      clearInterval(progressInterval);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error analyzing items:', errorMessage);

      // Track failed items
      const failedSet = new Set(failedAnalysisItems);
      itemsToAnalyze.forEach(id => failedSet.add(id));
      setFailedAnalysisItems(failedSet);
      setAnalysisRetryCount(prev => prev + 1);
      setShowRetryButton(true);

      // Provide user-friendly error messages based on error type
      let userMessage = 'Failed to analyze ';
      if (retryFailedOnly) {
        userMessage += `${failedSet.size} item(s) after ${analysisRetryCount + 1} retry attempt(s). `;
      } else {
        userMessage += `items. `;
      }

      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        userMessage += 'Please check your internet connection and try again.';
      } else if (errorMessage.includes('408') || errorMessage.includes('504') || errorMessage.includes('timeout')) {
        userMessage += 'Request timed out. Try with fewer items or retry failed items.';
      } else {
        userMessage += 'Please try again or contact support if the problem persists.';
      }

      setOperationError(userMessage);
      setShowErrorModal(true);
      return null;
    } finally {
      setAnalyzingItems(false);
      setAnalysisProgress(0);
      setAnalysisTotalItems(0);
      setAnalysisStartTime(null);
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

      if (!response.ok) {
        alert('Failed to auto-select disputable items');
        return;
      }

      const data = await response.json();
      const recommendedIds: string[] = data.recommended_item_ids || [];
      setSelectedItems(recommendedIds);

      if (generationMethod === 'template') {
        setItemDisputeInstructions(prev => {
          const newMap = new Map(prev);
          recommendedIds.forEach(id => {
            if (!newMap.has(id)) {
              newMap.set(id, { itemId: id, instructionType: 'preset', presetCode: '' });
            }
          });
          return newMap;
        });
      }

      if (data.summary?.recommendedMethodology) {
        setSelectedMethodology(data.summary.recommendedMethodology);
        setRecommendedMethodology(data.summary.recommendedMethodology);
      }

      if (data.summary?.recommendedReasonCodes) {
        setSelectedReasonCodes(data.summary.recommendedReasonCodes);
      }

      setAiAnalysisResults(data.analyses || []);
      setAiAnalysisSummary(
        data.summary
          ? {
              itemCount: data.summary.itemCount ?? recommendedIds.length,
              recommendedMethodology: data.summary.recommendedMethodology,
              allReasonCodes: data.summary.allReasonCodes ?? [],
              recommendedReasonCodes: data.summary.recommendedReasonCodes ?? [],
              averageConfidence: data.summary.averageConfidence ?? 0,
              allMetro2Violations: [],
              allFcraIssues: [],
              analysisNotes: '',
            }
          : null,
      );
      setAutoSelectSummary(
        `Selected ${recommendedIds.length} of ${data.summary?.itemCount ?? negativeItems.length} disputable items (avg confidence ${data.summary?.averageConfidence ?? 0})`
      );
    } catch (error) {
      console.error('Error auto-selecting items:', error);
      alert('Error auto-selecting disputable items');
    } finally {
      setAutoSelecting(false);
    }
  };

  // Get recommended methodology based on selected items
  const getRecommendedMethodologyForItems = React.useCallback(() => {
    if (selectedItems.length === 0) return null;
    
    // Check if any item is a collection - recommend debt_validation
    const hasCollection = negativeItems
      .filter(i => selectedItems.includes(i.id))
      .some(i => i.item_type === 'collection');
    
    if (hasCollection && disputeRound === 1) {
      return 'debt_validation';
    }
    
    // For round 2+, recommend method_of_verification
    if (disputeRound >= 2) {
      return 'method_of_verification';
    }
    
    return 'factual';
  }, [selectedItems, negativeItems, disputeRound]);

  React.useEffect(() => {
    fetchClients();
    fetchReasonCodes();
    fetchMethodologies();

    // Check for draft recovery on mount
    if (hasDraft()) {
      const metadata = getDraftMetadata();
      setDraftMetadata(metadata);
      setShowDraftRecovery(true);
    }
  }, [fetchClients]);

  // P3.4: Load analysis preferences on mount
  React.useEffect(() => {
    const savedPreferences = localStorage.getItem('dispute-analysis-preferences');
    if (savedPreferences) {
      try {
        const prefs = JSON.parse(savedPreferences);
        if (prefs.aggressiveness) {
          setAnalysisAggressiveness(prefs.aggressiveness);
        }
      } catch (error) {
        console.error('Failed to load analysis preferences:', error);
      }
    }
  }, []);

  // Auto-save draft whenever wizard state changes
  React.useEffect(() => {
    if (!selectedClient) return; // Don't save if no client selected

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
      selectedMethodology,
      requestManualReview,
      selectedEvidenceIds,
      currentStep,
      selectedReasonCodes,
    };

    wizardDraft.setupAutoSave(draftData, {
      clientName: `${selectedClient.first_name} ${selectedClient.last_name}`,
    });

    return () => {
      // Cleanup is handled by hook
    };
  }, [
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
    wizardDraft,
  ]);

  // Update recommended methodology when items or round changes
  React.useEffect(() => {
    const recommended = getRecommendedMethodologyForItems();
    setRecommendedMethodology(recommended);
  }, [getRecommendedMethodologyForItems]);

  // Refetch reason codes when methodology changes
  React.useEffect(() => {
    if (selectedMethodology) {
      fetchReasonCodes(selectedMethodology);
    }
  }, [selectedMethodology]);

  React.useEffect(() => {
    if (selectedClient) {
      fetchNegativeItems(selectedClient.id);
      fetchDiscrepancies(selectedClient.id);
      fetchTriage(selectedClient.id);
      fetchEvidence(selectedClient.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClient]);

  // Keyboard navigation
  React.useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Enter key: proceed to next step
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        if (currentStep < maxSteps) {
          // Check if current step is valid before proceeding
          const stepErrors = validationErrors[currentStep];
          if (!stepErrors || stepErrors.length === 0) {
            setCurrentStep(currentStep + 1);
          }
        }
      }

      // Escape key: go back to previous step
      if (e.key === 'Escape' && currentStep > 1) {
        e.preventDefault();
        setCurrentStep(currentStep - 1);
      }
    };

    // Add event listener
    window.addEventListener('keydown', handleKeyPress);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [currentStep, maxSteps, validationErrors]);

  // Handle evidence file upload
  const handleUploadEvidence = async (files: File[]) => {
    if (!selectedClient) return;

    const formData = new FormData();
    formData.append('clientId', selectedClient.id);

    files.forEach((file) => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/admin/disputes/evidence/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const newDocuments = data.documents || [];

        // Add new documents to the list and select them
        setEvidenceDocuments((prev) => [...prev, ...newDocuments]);
        setSelectedEvidenceIds((prev) => [
          ...prev,
          ...newDocuments.map((doc: EvidenceDocument) => doc.id),
        ]);

        // Close modal after successful upload
        setShowEvidenceUploadModal(false);
      } else {
        const error = await response.text();
        throw new Error(error || 'Failed to upload evidence');
      }
    } catch (error) {
      console.error('Error uploading evidence:', error);
      setOperationError(
        error instanceof Error ? error.message : 'Failed to upload evidence documents'
      );
      setShowErrorModal(true);
    }
  };

  // Handle evidence document removal
  const handleRemoveEvidence = async (documentId: string) => {
    if (!selectedClient) return;

    try {
      const response = await fetch('/api/admin/disputes/evidence/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient.id,
          documentId,
        }),
      });

      if (response.ok) {
        // Remove from both lists
        setEvidenceDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
        setSelectedEvidenceIds((prev) => prev.filter((id) => id !== documentId));
      } else {
        const error = await response.text();
        throw new Error(error || 'Failed to remove evidence');
      }
    } catch (error) {
      console.error('Error removing evidence:', error);
      setOperationError(
        error instanceof Error ? error.message : 'Failed to remove evidence document'
      );
      setShowErrorModal(true);
    }
  };

  // Generate letters
  // Accepts optional analysis data to avoid React state timing issues
  const generateLetters = async (analysisData?: { analyses: AIAnalysisResult[]; summary: AIAnalysisSummary } | null) => {
    if (!selectedClient) {
      return;
    }

    // Check evidence requirements for high-risk dispute codes
    const usedReasonCodes = generationMethod === 'ai'
      ? (analysisData?.summary?.allReasonCodes || aiAnalysisSummary?.allReasonCodes || [])
      : selectedReasonCodes;

    const evidenceValidation = validateEvidenceRequirements(
      usedReasonCodes,
      selectedEvidenceIds,
      selectedItems
    );

    // If evidence is required but not provided, and user hasn't overridden, block generation
    if (!evidenceValidation.isValid && !evidenceOverrideConfirmed) {
      setEvidenceBlockingStatus(evidenceValidation);
      setShowEvidenceBlockingModal(true);
      return;
    }

    const selectedTradelines = negativeItems.filter(i => selectedItems.includes(i.id));
    const selectedPersonal = personalInfoItems.filter(i => selectedPersonalItems.includes(i.id));
    const selectedInquiries = inquiryItems.filter(i => selectedInquiryItems.includes(i.id));

    const selectedDisputeItems: Array<{ kind: DisputeItemKind; raw: NegativeItem | PersonalInfoItem | InquiryItem; payload: DisputeItemPayload }>
      = [
        ...selectedTradelines.map(item => ({
          kind: 'tradeline' as const,
          raw: item,
          payload: {
            id: item.id,
            kind: 'tradeline' as DisputeItemKind,
            bureau: item.bureau,
            creditorName: item.creditor_name,
            originalCreditor: item.original_creditor,
            accountNumber: item.account_number,
            itemType: item.item_type,
            amount: item.amount,
            riskSeverity: item.risk_severity,
          },
        })),
        ...selectedPersonal.map(item => ({
          kind: 'personal' as const,
          raw: item,
          payload: {
            id: item.id,
            kind: 'personal' as DisputeItemKind,
            bureau: item.bureau,
            itemType: `personal_info_${item.type}`,
            value: item.value,
          },
        })),
        ...selectedInquiries.map(item => ({
          kind: 'inquiry' as const,
          raw: item,
          payload: {
            id: item.id,
            kind: 'inquiry' as DisputeItemKind,
            bureau: item.bureau,
            creditorName: item.creditor_name,
            itemType: 'inquiry',
            inquiryDate: item.inquiry_date,
            inquiryType: item.inquiry_type,
            isPastFcraLimit: item.is_past_fcra_limit,
            daysSinceInquiry: item.days_since_inquiry,
          },
        })),
      ];

    if (selectedDisputeItems.length === 0) {
      return;
    }

    // Use passed analysis data or fall back to state (for non-AI mode or re-generation)
    const effectiveAnalyses = analysisData?.analyses || aiAnalysisResults;
    const effectiveSummary = analysisData?.summary || aiAnalysisSummary;

    // For AI mode, we use AI analysis; for template mode, we use per-item instructions
    const baseReasonCodes = generationMethod === 'ai' 
      ? (effectiveSummary?.allReasonCodes || ['verification_required', 'inaccurate_reporting'])
      : [];

    const reasonCodeSet = new Set(baseReasonCodes);
    if (selectedPersonal.length > 0) {
      reasonCodeSet.add('verification_required');
      reasonCodeSet.add('inaccurate_reporting');
    }
    if (selectedInquiries.length > 0) {
      reasonCodeSet.add(selectedInquiries.some(i => i.is_past_fcra_limit) ? 'obsolete' : 'unauthorized_inquiry');
      reasonCodeSet.add('verification_required');
    }

    const reasonCodesToUse = Array.from(reasonCodeSet);

    setGenerating(true);
    setGenerationProgress(0);
    const letters: typeof generatedLetters = [];
    
    // Use AI-determined methodology or user-selected
    const methodologyToUse = generationMethod === 'ai' 
      ? (effectiveSummary?.recommendedMethodology || selectedMethodology)
      : selectedMethodology;

    const bureausToUse = targetRecipient === 'bureau' ? selectedBureaus : ['direct'];

    // Build per-item instructions map for template mode
    const perItemInstructions: Record<string, string> = {};
    if (generationMethod === 'template') {
      selectedItems.forEach(itemId => {
        const instruction = itemDisputeInstructions.get(itemId);
        if (instruction) {
          perItemInstructions[itemId] = getInstructionText(itemId);
        }
      });
    }

    const itemAppliesToBureau = (entry: { kind: DisputeItemKind; raw: NegativeItem | PersonalInfoItem | InquiryItem; payload: DisputeItemPayload }, bureau: string) => {
      if (entry.kind === 'tradeline') {
        return itemAppearsOnBureau(entry.raw as NegativeItem, bureau);
      }
      return !entry.payload.bureau || entry.payload.bureau.toLowerCase() === bureau.toLowerCase();
    };

    // Combined letter mode: one letter per bureau with all selected items
    if (combineItemsPerBureau && targetRecipient === 'bureau') {
      const bureausWithItems = bureausToUse.filter(bureau =>
        selectedDisputeItems.some(entry => itemAppliesToBureau(entry, bureau))
      );
      const totalLetters = bureausWithItems.length;
      let completed = 0;

      for (const bureau of bureausWithItems) {
        const itemsForThisBureau = selectedDisputeItems
          .filter(entry => itemAppliesToBureau(entry, bureau))
          .map(entry => entry.payload);

        try {
          const response = await fetch('/api/admin/disputes/generate-letter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: selectedClient.id,
              disputeItems: itemsForThisBureau,
              bureau,
              disputeType: selectedDisputeType,
              round: disputeRound,
              targetRecipient,
              reasonCodes: reasonCodesToUse,
              customReason: customReason || undefined,
              combineItems: true,
              methodology: methodologyToUse,
              perItemInstructions: generationMethod === 'template' ? perItemInstructions : undefined,
              metro2Violations: generationMethod === 'ai' ? effectiveSummary?.allMetro2Violations : undefined,
              evidenceDocumentIds: selectedEvidenceIds.length > 0 ? selectedEvidenceIds : undefined,
              requestManualReview: requestManualReview,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            letters.push({
              id: `letter-${bureau}-${itemsForThisBureau.map(i => i.id).join('-')}`,
              bureau,
              itemId: itemsForThisBureau[0]?.id || '',
              itemIds: itemsForThisBureau.map(i => i.id),
              items: itemsForThisBureau,
              content: data.letter_content,
              combined: true,
            });
          }
        } catch (error) {
          console.error('Error generating combined letter:', error);
        }

        completed++;
        setGenerationProgress(totalLetters === 0 ? 0 : Math.round((completed / totalLetters) * 100));
      }
    } else {
      // Individual letter mode: one letter per item per bureau
      const itemBureauPairs = selectedDisputeItems.flatMap(entry => {
        if (targetRecipient !== 'bureau') {
          return [{ entry, bureau: entry.payload.bureau || 'transunion' }];
        }
        return bureausToUse
          .filter(bureau => itemAppliesToBureau(entry, bureau))
          .map(bureau => ({ entry, bureau }));
      });

      let completed = 0;
      const totalLetters = itemBureauPairs.length;

      for (const { entry, bureau } of itemBureauPairs) {
        const itemInstruction = generationMethod === 'template' && entry.kind === 'tradeline'
          ? getInstructionText(entry.payload.id)
          : customReason || undefined;

        try {
          const response = await fetch('/api/admin/disputes/generate-letter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: selectedClient.id,
              disputeItems: [entry.payload],
              bureau: targetRecipient === 'bureau' ? bureau : entry.payload.bureau || 'transunion',
              disputeType: selectedDisputeType,
              round: disputeRound,
              targetRecipient,
              reasonCodes: reasonCodesToUse,
              customReason: itemInstruction || undefined,
              creditorName: entry.payload.creditorName,
              itemType: entry.payload.itemType,
              amount: entry.payload.amount,
              methodology: methodologyToUse,
              disputeInstruction: itemInstruction,
              metro2Violations: generationMethod === 'ai' && entry.kind === 'tradeline'
                ? effectiveAnalyses.find(a => a.itemId === entry.payload.id)?.metro2Violations
                : undefined,
              evidenceDocumentIds: selectedEvidenceIds.length > 0 ? selectedEvidenceIds : undefined,
              requestManualReview: requestManualReview,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            letters.push({
              id: `letter-${bureau}-${entry.payload.id}`,
              bureau,
              itemId: entry.payload.id,
                itemKind: entry.kind,
                items: [entry.payload],
              content: data.letter_content,
              combined: false,
            });
          }
        } catch (error) {
          console.error('Error generating letter:', error);
        }

        completed++;
        setGenerationProgress(totalLetters === 0 ? 0 : Math.round((completed / totalLetters) * 100));
      }
    }

    setGeneratedLetters(letters);
    setGenerating(false);
    setCurrentStep(reviewStepId); // Go to review step (4 for both modes now)
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

  const handleToggleItem = (itemId: string) => {
    toggleItemSelection(itemId);
  };

  const handleToggleBureau = (bureau: string) => {
    setSelectedBureaus(prev =>
      prev.includes(bureau)
        ? prev.filter(b => b !== bureau)
        : [...prev, bureau]
    );
  };

  const _handleToggleReasonCode = (code: string) => {
    setSelectedReasonCodes(prev =>
      prev.includes(code)
        ? prev.filter(c => c !== code)
        : [...prev, code]
    );
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const downloadLetter = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleBulkMarkAsSent = async () => {
    if (!selectedClient || generatedLetters.length === 0) return;
    
    setMarkingAsSent(true);
    setBulkSentSuccess(false);
    
    try {
      const sendDate = bulkSendDate ? new Date(bulkSendDate) : new Date();
      const responseDeadline = new Date(sendDate);
      responseDeadline.setDate(responseDeadline.getDate() + 30); // 30-day FCRA deadline
      
      // Create disputes for each generated letter
      for (const letter of generatedLetters) {
        const item = negativeItems.find(i => i.id === letter.itemId);
        const payload = letter.items?.[0];
        
        await fetch('/api/admin/disputes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: selectedClient.id,
            negativeItemId: letter.itemId,
            bureau: letter.bureau,
            disputeReason: selectedReasonCodes.join(', '),
            disputeType: selectedDisputeType,
            round: disputeRound,
            status: 'sent',
            letterContent: letter.content,
            trackingNumber: bulkTrackingNumber || null,
            sentAt: sendDate.toISOString(),
            responseDeadline: responseDeadline.toISOString(),
            creditorName: payload?.creditorName || item?.creditor_name,
            accountNumber: payload?.accountNumber || item?.account_number || null,
            generatedByAi: generationMethod === 'ai',
            reasonCodes: selectedReasonCodes,
            analysisConfidence: aiAnalysisSummary?.averageConfidence
              ? Math.round(aiAnalysisSummary.averageConfidence * 100)
              : undefined,
            autoSelected: !!autoSelectSummary,
            targetRecipient,
          }),
        });
      }
      
      setBulkSentSuccess(true);
    } catch (error) {
      console.error('Error marking disputes as sent:', error);
      alert('Failed to save some disputes. Please try again.');
    } finally {
      setMarkingAsSent(false);
    }
  };

  const getStepValidation = (step: number): { errors: string[]; warnings: string[] } => {
    let validationResult: ValidationResult | null = null;
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (step) {
      case 1:
        validationResult = validateStep1(selectedClient?.id ?? null);
        break;
      case 2: {
        validationResult = validateStep2(selectedItems, {});
        // Also validate personal items and inquiries for selection
        const totalSelected = selectedItems.length + selectedPersonalItems.length + selectedInquiryItems.length;
        if (totalSelected === 0) {
          errors.push('Please select at least one item to dispute');
        }
        // For template mode, check for dispute instructions
        if (generationMethod === 'template') {
          const missingInstructions = selectedItems.filter(itemId => {
            const instruction = itemDisputeInstructions.get(itemId);
            if (!instruction) return true;
            if (instruction.instructionType === 'preset' && instruction.presetCode && instruction.presetCode !== 'custom') return false;
            if (instruction.instructionType === 'custom' && instruction.customText && instruction.customText.trim().length > 0) return false;
            return true;
          });
          if (missingInstructions.length > 0) {
            errors.push(`${missingInstructions.length} item(s) missing dispute instructions`);
          }
        }
        break;
      }
      case 3:
        validationResult = validateStep3(selectedBureaus, disputeRound);
        if (discrepancySummary?.highSeverity && discrepancySummary.highSeverity > 0) {
          errors.push('Unable to proceed with high-severity discrepancies detected');
        }
        break;
      case 4:
        validationResult = validateStep4(generatedLetters);
        break;
    }

    // Merge validation results
    if (validationResult) {
      errors.push(...validationResult.errors);
      warnings.push(...validationResult.warnings);
    }

    return { errors, warnings };
  };

  // Validate current step and update validation state
  const validateCurrentStep = (): boolean => {
    const { errors, warnings } = getStepValidation(currentStep);

    // Update state with validation results
    const newErrors = { ...validationErrors };
    const newWarnings = { ...validationWarnings };

    if (errors.length > 0) {
      newErrors[currentStep] = errors;
    } else {
      delete newErrors[currentStep];
    }

    if (warnings.length > 0) {
      newWarnings[currentStep] = warnings;
    } else {
      delete newWarnings[currentStep];
    }

    setValidationErrors(newErrors);
    setValidationWarnings(newWarnings);

    return errors.length === 0;
  };

  const canProceed = (): boolean => {
    return getStepValidation(currentStep).errors.length === 0;
  };

  const formatItemType = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const formatPersonalInfoType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatCurrency = (cents: number | null) => {
    if (!cents) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  // Error modal/alert component
  const renderErrorAlert = () => {
    if (!operationError || !showErrorModal) return null;

    const hasFailedItems = failedAnalysisItems.size > 0 && generationMethod === 'ai';

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-md"
        >
          <Card className="bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="w-5 h-5" />
                Analysis Error
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{operationError}</p>

              {/* Show failed items if any */}
              {hasFailedItems && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                  <p className="text-xs font-semibold text-red-900 dark:text-red-200 mb-2">
                    Failed Items ({failedAnalysisItems.size}):
                  </p>
                  <ul className="text-xs text-red-800 dark:text-red-300 space-y-1">
                    {Array.from(failedAnalysisItems).slice(0, 3).map((itemId) => {
                      const item = negativeItems.find(i => i.id === itemId) ||
                                  personalInfoItems.find(i => i.id === itemId) ||
                                  inquiryItems.find(i => i.id === itemId);
                      let displayName = itemId;
                      if (item && 'creditor_name' in item && typeof item.creditor_name === 'string') {
                        displayName = item.creditor_name;
                      }
                      return (
                        <li key={itemId} className="list-disc list-inside">
                          {displayName}
                        </li>
                      );
                    })}
                    {failedAnalysisItems.size > 3 && (
                      <li className="text-red-700 dark:text-red-400 font-medium">
                        +{failedAnalysisItems.size - 3} more items
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowErrorModal(false);
                    setOperationError(null);
                  }}
                >
                  Dismiss
                </Button>

                {/* Retry Failed Items Button */}
                {hasFailedItems && analysisRetryCount < 3 && (
                  <Button
                    onClick={async () => {
                      setShowErrorModal(false);
                      setOperationError(null);
                      await analyzeItemsWithAI(true);
                    }}
                    className="bg-yellow-600 hover:bg-yellow-700"
                    disabled={analyzingItems}
                  >
                    {analyzingItems ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Retrying...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 mr-2" />
                        Retry {failedAnalysisItems.size} Item{failedAnalysisItems.size !== 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                )}

                <Button
                  onClick={() => {
                    setShowErrorModal(false);
                    setOperationError(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Continue
                </Button>
              </div>

              {analysisRetryCount >= 3 && hasFailedItems && (
                <p className="text-xs text-red-600 dark:text-red-400 italic">
                  Maximum retry attempts reached. Please try with fewer items or contact support.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  };

  // Render validation messages (errors and warnings) for current step
  const renderValidationMessages = () => {
    const errors = validationErrors[currentStep] || [];
    const warnings = validationWarnings[currentStep] || [];

    return (
      <>
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-2">Validation Errors</h3>
                <ul className="space-y-1">
                  {errors.map((error, idx) => (
                    <li key={idx} className="text-red-800 text-sm">
                      • {error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {warnings.length > 0 && errors.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-2">Warnings</h3>
                <ul className="space-y-1">
                  {warnings.map((warning, idx) => (
                    <li key={idx} className="text-yellow-800 text-sm">
                      • {warning}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  // Helper: Update dispute instruction for an item
  const updateItemInstruction = (itemId: string, instructionType: 'preset' | 'custom', value: string) => {
    setItemDisputeInstructions(prev => {
      const newMap = new Map(prev);
      if (instructionType === 'preset') {
        newMap.set(itemId, {
          itemId,
          instructionType: value === 'custom' ? 'custom' : 'preset',
          presetCode: value,
          customText: value === 'custom' ? (prev.get(itemId)?.customText || '') : undefined,
        });
      } else {
        newMap.set(itemId, {
          itemId,
          instructionType: 'custom',
          presetCode: 'custom',
          customText: value,
        });
      }
      return newMap;
    });
  };

  // Helper: Get the dispute instruction text for an item
  const getInstructionText = (itemId: string): string => {
    const instruction = itemDisputeInstructions.get(itemId);
    if (!instruction) return '';
    if (instruction.instructionType === 'custom') return instruction.customText || '';
    const preset = PRESET_DISPUTE_INSTRUCTIONS.find(p => p.code === instruction.presetCode);
    return preset?.description || '';
  };

  // Helper: Toggle item selection
  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        // Removing item - also remove its instruction
        setItemDisputeInstructions(prevInstructions => {
          const newMap = new Map(prevInstructions);
          newMap.delete(itemId);
          return newMap;
        });
        return prev.filter(id => id !== itemId);
      } else {
        // Adding item - initialize with empty preset
        if (generationMethod === 'template') {
          setItemDisputeInstructions(prevInstructions => {
            const newMap = new Map(prevInstructions);
            newMap.set(itemId, { itemId, instructionType: 'preset', presetCode: '' });
            return newMap;
          });
        }
        return [...prev, itemId];
      }
    });
  };

  // Build step statuses for progress bar
  const buildStepStatuses = (): StepStatus[] => {
    return WIZARD_STEPS.map((step) => {
      const stepErrors = validationErrors[step.id] || [];
      const stepWarnings = validationWarnings[step.id] || [];
      const isComplete =
        (step.id === 1 && selectedClient !== null) ||
        (step.id === 2 && selectedItems.length > 0) ||
        (step.id === 3 && selectedBureaus.length > 0) ||
        (step.id === 4 && generatedLetters.length > 0);

      return {
        stepId: step.id,
        isComplete,
        hasErrors: stepErrors.length > 0,
        hasWarnings: stepWarnings.length > 0,
        isCurrentStep: currentStep === step.id,
      };
    });
  };

  const stepStatuses = buildStepStatuses();

  // Handle step navigation from progress bar
  const handleStepClick = (stepId: number) => {
    if (stepId < currentStep) {
      setCurrentStep(stepId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error Alert Modal */}
      {renderErrorAlert()}

      {/* Draft Recovery Modal */}
      {showDraftRecovery && draftMetadata && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-blue-500" />
                Resume Draft?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Client:</strong> {draftMetadata.clientName || 'Unknown'}
                </p>
                <p>
                  <strong>Items:</strong> {draftMetadata.itemCount || 0}
                </p>
                <p>
                  <strong>Last Saved:</strong> {new Date(draftMetadata.lastSavedAt).toLocaleString()}
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                You have a saved draft from a previous session. Would you like to resume where you left off?
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDraftRecovery(false);
                    wizardDraft.clearDraft();
                  }}
                >
                  Start New
                </Button>
                <Button
                  onClick={async () => {
                    // Load draft data from localStorage
                    const draft = wizardDraft.loadDraft();
                    if (!draft) {
                      setShowDraftRecovery(false);
                      return;
                    }

                    // Restore Step 1: Client Selection
                    if (draft.selectedClientId) {
                      // Find the client from the loaded clients list
                      let clientToRestore = clients.find(c => c.id === draft.selectedClientId);

                      // If client not in current list, fetch all clients and try again
                      if (!clientToRestore && draft.clientSearch) {
                        setClientSearch(draft.clientSearch);
                        // Try to find client in full list after search
                        const allClientsResponse = await fetch(`/api/admin/clients?limit=1000&status=active`);
                        if (allClientsResponse.ok) {
                          const allClientsData = await allClientsResponse.json();
                          clientToRestore = allClientsData.items.find((c: Client) => c.id === draft.selectedClientId);
                        }
                      }

                      if (clientToRestore) {
                        setSelectedClient(clientToRestore);
                        // Fetch items for the client
                        await fetchNegativeItems(clientToRestore.id);
                      }
                    }

                    // Restore Step 2: Item Selection
                    if (draft.selectedItems) {
                      setSelectedItems(draft.selectedItems);
                    }
                    if (draft.selectedPersonalItems) {
                      setSelectedPersonalItems(draft.selectedPersonalItems);
                    }
                    if (draft.selectedInquiryItems) {
                      setSelectedInquiryItems(draft.selectedInquiryItems);
                    }
                    if (draft.activeTab) {
                      setActiveTab(draft.activeTab);
                    }
                    if (draft.itemDisputeInstructions) {
                      // Restore Map from draft data (it's serialized as array of entries)
                      if (Array.isArray(draft.itemDisputeInstructions)) {
                        setItemDisputeInstructions(new Map(draft.itemDisputeInstructions));
                      } else if (draft.itemDisputeInstructions instanceof Map) {
                        setItemDisputeInstructions(draft.itemDisputeInstructions);
                      }
                    }

                    // Restore Step 3: Configuration
                    if (draft.disputeRound !== undefined) {
                      setDisputeRound(draft.disputeRound);
                    }
                    if (draft.targetRecipient) {
                      setTargetRecipient(draft.targetRecipient);
                    }
                    if (draft.selectedBureaus) {
                      setSelectedBureaus(draft.selectedBureaus);
                    }
                    if (draft.generationMethod) {
                      setGenerationMethod(draft.generationMethod);
                    }
                    if (draft.combineItemsPerBureau !== undefined) {
                      setCombineItemsPerBureau(draft.combineItemsPerBureau);
                    }
                    if (draft.selectedMethodology) {
                      setSelectedMethodology(draft.selectedMethodology);
                    }
                    if (draft.requestManualReview !== undefined) {
                      setRequestManualReview(draft.requestManualReview);
                    }
                    if (draft.selectedEvidenceIds) {
                      setSelectedEvidenceIds(draft.selectedEvidenceIds);
                    }
                    if (draft.selectedReasonCodes) {
                      setSelectedReasonCodes(draft.selectedReasonCodes);
                    }

                    // Restore current step
                    const stepToRestore = draft.currentStep || 1;
                    setCurrentStep(stepToRestore);

                    // Close the modal
                    setShowDraftRecovery(false);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
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
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                Evidence Required for High-Risk Disputes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-4">
                <p className="text-sm text-red-900 dark:text-red-200 font-medium mb-3">
                  ⚠️ This dispute uses high-risk reason codes that require supporting evidence:
                </p>
                <ul className="space-y-2">
                  {evidenceBlockingStatus.blockingReasons.map((reason, idx) => (
                    <li key={idx} className="text-sm text-red-800 dark:text-red-300">
                      • {reason}
                    </li>
                  ))}
                </ul>
              </div>

              {evidenceBlockingStatus.requiredEvidenceMissing.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
                  <p className="text-sm text-blue-900 dark:text-blue-200 font-medium mb-2">
                    Required Evidence:
                  </p>
                  <ul className="space-y-1">
                    {evidenceBlockingStatus.requiredEvidenceMissing.map((doc, idx) => (
                      <li key={idx} className="text-sm text-blue-800 dark:text-blue-300">
                        • {doc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Please upload the required evidence documents before proceeding. Evidence significantly strengthens
                high-risk disputes and ensures proper investigation by credit bureaus.
              </p>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEvidenceBlockingModal(false);
                    setEvidenceBlockingStatus(null);
                    setShowEvidenceUploadModal(true);
                  }}
                >
                  Cancel & Upload Evidence
                </Button>
                <Button
                  onClick={() => {
                    setEvidenceOverrideConfirmed(true);
                    setShowEvidenceBlockingModal(false);
                    // Re-trigger generation with override
                    setTimeout(() => {
                      const generateBtn = document.querySelector('[data-generate-button]') as HTMLButtonElement;
                      generateBtn?.click();
                    }, 0);
                  }}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Proceed Without Evidence (Admin Override)
                </Button>
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-md bg-card border border-border/50 rounded-lg shadow-lg p-6"
          >
            <div className="space-y-4">
              {/* Title */}
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                <h2 className="text-lg font-semibold text-foreground">Analyzing Items</h2>
              </div>

              {/* Item Counter */}
              <div className="text-sm text-muted-foreground">
                <p className="font-medium">
                  Item <span className="text-foreground">{analysisProgress.toFixed(0)}</span> of{' '}
                  <span className="text-foreground">{analysisTotalItems}</span>
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <motion.div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(analysisProgress, 100)}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>{Math.round(analysisProgress)}% Complete</span>
                  {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
                    <span>~{estimatedTimeRemaining}s remaining</span>
                  )}
                </div>
              </div>

              {/* Status Message */}
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                <p className="text-sm text-blue-900 dark:text-blue-200">
                  Analyzing accounts for disputes and gathering Metro 2 violation data...
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-serif font-bold text-foreground"
          >
            Dispute Wizard
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Generate AI-powered dispute letters with FCRA, CRSA, and Metro 2 compliance
          </motion.p>
        </div>
        <Button variant="outline" onClick={() => router.push('/admin/clients')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Clients
        </Button>
      </div>

      {/* Progress Steps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-6">
            <DisputeWizardProgressBar
              steps={WIZARD_STEPS}
              currentStep={currentStep}
              stepStatuses={stepStatuses}
              onStepClick={handleStepClick}
              maxSteps={WIZARD_STEPS.length}
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* Step Content */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
      >
        {/* Step 1: Select Client */}
        {currentStep === 1 && (
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>
                Select Client
                <span className="text-red-600 dark:text-red-400 ml-1">*</span>
                {!selectedClient && (
                  <span className="text-xs text-red-600 dark:text-red-400 ml-3 font-normal">
                    (Required)
                  </span>
                )}
              </CardTitle>
              <CardDescription>Choose a client to generate dispute letters for</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderValidationMessages()}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients by name or email..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              {loadingClients ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                </div>
              ) : (
                <div className="grid gap-3 max-h-[400px] overflow-y-auto">
                  {clients.map((client) => {
                    const firstName = typeof client.first_name === 'string' ? client.first_name.trim() : '';
                    const lastName = typeof client.last_name === 'string' ? client.last_name.trim() : '';
                    const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.trim() || '?';
                    const fullName = `${firstName} ${lastName}`.trim() || 'Unknown Client';

                    return (
                    <div
                      key={client.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        selectedClient?.id === client.id
                          ? 'border-secondary bg-secondary/10'
                          : 'border-border hover:border-secondary/50'
                      }`}
                      onClick={() => handleSelectClient(client)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-primary font-bold">
                          {initials}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{fullName}</p>
                          <p className="text-sm text-muted-foreground">{client.email || '—'}</p>
                        </div>
                        {selectedClient?.id === client.id && (
                          <Check className="w-5 h-5 text-secondary" />
                        )}
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Items */}
        {currentStep === 2 && (
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>
                Select Dispute Items
                <span className="text-red-600 dark:text-red-400 ml-1">*</span>
                {selectedItems.length === 0 && selectedPersonalItems.length === 0 && selectedInquiryItems.length === 0 && (
                  <span className="text-xs text-red-600 dark:text-red-400 ml-3 font-normal">
                    (Select at least one)
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Choose tradelines, personal info, or inquiries to dispute for {selectedClient?.first_name} {selectedClient?.last_name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderValidationMessages()}
              {/* Info box for template mode */}
              {generationMethod === 'template' && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm text-blue-400">
                    <strong>Template Mode:</strong> Select items below and set a dispute instruction for each one. 
                    You can choose from pre-built reasons or enter a custom instruction.
                  </p>
                </div>
              )}

              {/* Item type tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { key: 'tradelines' as const, label: `Tradelines (${negativeItems.length})` },
                  { key: 'personal' as const, label: `Personal Info (${personalInfoItems.length})` },
                  { key: 'inquiries' as const, label: `Inquiries (${inquiryItems.length})` },
                ].map(tab => (
                  <Button
                    key={tab.key}
                    variant={activeTab === tab.key ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab(tab.key)}
                  >
                    {tab.label}
                  </Button>
                ))}
                <span className="text-sm text-muted-foreground ml-auto">
                  Selected: {selectedItems.length + selectedPersonalItems.length + selectedInquiryItems.length}
                </span>
              </div>
              
              {/* Info box for AI mode */}
              {generationMethod === 'ai' && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-sm text-green-400">
                    <strong>AI Mode:</strong> Simply select items to dispute. The AI will automatically analyze 
                    each item for Metro 2 compliance violations and FCRA issues.
                  </p>
                </div>
              )}
              
              {activeTab === 'tradelines' && (
                <>
                  {/* Triage Quick Actions */}
                  {triageQuickActions.length > 0 && (
                    <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-medium text-purple-400">Quick Actions</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {triageQuickActions.map((action) => (
                          <Button
                            key={action.id}
                            variant="outline"
                            size="sm"
                            className="text-xs border-purple-500/30 hover:bg-purple-500/10"
                            onClick={() => {
                              setSelectedItems(prev => [...new Set([...prev, ...action.itemIds])]);
                              if (generationMethod === 'template') {
                                setItemDisputeInstructions(prev => {
                                  const newMap = new Map(prev);
                                  action.itemIds.forEach(id => {
                                    if (!newMap.has(id)) {
                                      newMap.set(id, { itemId: id, instructionType: 'preset', presetCode: '' });
                                    }
                                  });
                                  return newMap;
                                });
                              }
                            }}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            {action.label} ({action.count})
                          </Button>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Click to quickly select items by category
                      </p>
                    </div>
                  )}

                  {loadingItems ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                    </div>
                  ) : negativeItems.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No negative items found for this client.</p>
                      <p className="text-sm text-muted-foreground mt-1">Upload and analyze a credit report first.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <span className="text-sm text-muted-foreground">
                          {selectedItems.length} of {negativeItems.length} items selected
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Select by Bureau */}
                          {['transunion', 'experian', 'equifax'].map((bureau) => {
                            const bureauItems = negativeItems.filter(i => i.bureau === bureau || itemAppearsOnBureau(i, bureau));
                            if (bureauItems.length === 0) return null;
                            const allSelected = bureauItems.every(i => selectedItems.includes(i.id));
                            return (
                              <Button
                                key={bureau}
                                variant={allSelected ? 'secondary' : 'outline'}
                                size="sm"
                                onClick={() => {
                                  if (allSelected) {
                                    // Deselect: remove items and their instructions
                                    const idsToRemove = bureauItems.map(i => i.id);
                                    setSelectedItems(prev => prev.filter(id => !idsToRemove.includes(id)));
                                    if (generationMethod === 'template') {
                                      setItemDisputeInstructions(prev => {
                                        const newMap = new Map(prev);
                                        idsToRemove.forEach(id => newMap.delete(id));
                                        return newMap;
                                      });
                                    }
                                  } else {
                                    // Select: add items and initialize their instructions
                                    const newIds = bureauItems.map(i => i.id);
                                    setSelectedItems(prev => [...new Set([...prev, ...newIds])]);
                                    if (generationMethod === 'template') {
                                      setItemDisputeInstructions(prev => {
                                        const newMap = new Map(prev);
                                        newIds.forEach(id => {
                                          if (!newMap.has(id)) {
                                            newMap.set(id, { itemId: id, instructionType: 'preset', presetCode: '' });
                                          }
                                        });
                                        return newMap;
                                      });
                                    }
                                  }
                                }}
                              >
                                {bureau.charAt(0).toUpperCase() + bureau.slice(1)}
                                <span className="ml-1 text-xs opacity-70">({bureauItems.length})</span>
                              </Button>
                            );
                          })}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={autoSelectDisputableItems}
                            disabled={!selectedClient || autoSelecting}
                          >
                            {autoSelecting ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Sparkles className="w-3 h-3 mr-1" />
                            )}
                            Select All Disputable
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (selectedItems.length === negativeItems.length) {
                                // Deselect all
                                setSelectedItems([]);
                                setItemDisputeInstructions(new Map());
                              } else {
                                // Select all
                                const allIds = negativeItems.map(i => i.id);
                                setSelectedItems(allIds);
                                if (generationMethod === 'template') {
                                  setItemDisputeInstructions(prev => {
                                    const newMap = new Map(prev);
                                    allIds.forEach(id => {
                                      if (!newMap.has(id)) {
                                        newMap.set(id, { itemId: id, instructionType: 'preset', presetCode: '' });
                                      }
                                    });
                                    return newMap;
                                  });
                                }
                              }
                            }}
                          >
                            {selectedItems.length === negativeItems.length ? 'Deselect All' : 'Select All'}
                          </Button>
                        </div>
                      </div>

                      {autoSelectSummary && (
                        <p className="text-xs text-muted-foreground">{autoSelectSummary}</p>
                      )}

                      {negativeItems.map((item) => {
                        const isSelected = selectedItems.includes(item.id);
                        const instruction = itemDisputeInstructions.get(item.id);
                        const showInstructionUI = isSelected && generationMethod === 'template';
                        
                        return (
                          <div
                            key={item.id}
                            className={`rounded-lg border transition-all ${
                              isSelected
                                ? 'border-secondary bg-secondary/10'
                                : 'border-border hover:border-secondary/50'
                            }`}
                          >
                            {/* Item Header - Clickable to select/deselect */}
                            <div
                              className="p-4 cursor-pointer"
                              onClick={() => handleToggleItem(item.id)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium">{item.creditor_name}</p>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      item.risk_severity === 'severe' ? 'bg-red-500/20 text-red-400' :
                                      item.risk_severity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                      item.risk_severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                      'bg-green-500/20 text-green-400'
                                    }`}>
                                      {item.risk_severity}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {formatItemType(item.item_type)} • {formatCurrency(item.amount)}
                                  </p>
                                  {/* Bureau Indicators - Show which bureaus this item appears on */}
                                  <div className="flex items-center gap-1.5 mt-2">
                                    <span className="text-xs text-muted-foreground mr-1">Bureaus:</span>
                                    {['transunion', 'experian', 'equifax'].map((bureau) => {
                                      // Uses new per-bureau boolean fields with fallback to legacy logic
                                      const appearsOn = itemAppearsOnBureau(item, bureau);
                                      // Get bureau-specific date for tooltip
                                      const bureauDate = bureau === 'transunion' ? item.transunion_date 
                                        : bureau === 'experian' ? item.experian_date 
                                        : item.equifax_date;
                                      const dateStr = bureauDate ? new Date(bureauDate).toLocaleDateString() : '';
                                      const bureauStatus = bureau === 'transunion' ? item.transunion_status 
                                        : bureau === 'experian' ? item.experian_status 
                                        : item.equifax_status;
                                      return (
                                        <span
                                          key={bureau}
                                          className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                            appearsOn
                                              ? bureau === 'transunion' ? 'bg-blue-500/20 text-blue-400' :
                                                bureau === 'experian' ? 'bg-purple-500/20 text-purple-400' :
                                                'bg-green-500/20 text-green-400'
                                              : 'bg-muted/50 text-muted-foreground/50 line-through'
                                          }`}
                                          title={appearsOn 
                                            ? `${bureau}${dateStr ? ` - ${dateStr}` : ''}${bureauStatus ? ` - ${bureauStatus}` : ''}` 
                                            : `Not reported on ${bureau}`}
                                        >
                                          {bureau === 'transunion' ? 'TU' : bureau === 'experian' ? 'EXP' : 'EQ'}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                  isSelected
                                    ? 'border-secondary bg-secondary'
                                    : 'border-muted-foreground/30'
                                }`}>
                                  {isSelected && (
                                    <Check className="w-3 h-3 text-primary" />
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Per-Item Dispute Instruction (Template Mode Only) */}
                            {showInstructionUI && (
                              <div 
                                className="px-4 pb-4 pt-2 border-t border-border/50 space-y-3"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <label className="text-xs font-medium text-muted-foreground">Dispute Instruction</label>
                                <select
                                  className="w-full p-2 rounded-md border border-border bg-background text-sm"
                                  value={instruction?.presetCode || ''}
                                  onChange={(e) => updateItemInstruction(item.id, 'preset', e.target.value)}
                                >
                                  <option value="">Select dispute reason...</option>
                                  {PRESET_DISPUTE_INSTRUCTIONS.map((preset) => (
                                    <option key={preset.code} value={preset.code}>
                                      {preset.label}
                                    </option>
                                  ))}
                                </select>
                                
                                {/* Custom text field when "Custom Instruction" is selected */}
                                {instruction?.presetCode === 'custom' && (
                                  <textarea
                                    className="w-full p-2 rounded-md border border-border bg-background text-sm min-h-[80px]"
                                    placeholder="Enter your custom dispute instruction for this account..."
                                    value={instruction?.customText || ''}
                                    onChange={(e) => updateItemInstruction(item.id, 'custom', e.target.value)}
                                  />
                                )}
                                
                                {/* Show selected instruction preview */}
                                {instruction?.presetCode && instruction.presetCode !== 'custom' && (
                                  <p className="text-xs text-muted-foreground italic">
                                    {PRESET_DISPUTE_INSTRUCTIONS.find(p => p.code === instruction.presetCode)?.description}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'personal' && (
                <>
                  {loadingItems ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                    </div>
                  ) : personalInfoItems.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No personal information discrepancies found.</p>
                      <p className="text-sm text-muted-foreground mt-1">Upload and parse a report to pull PII items.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <span className="text-sm text-muted-foreground">
                          {selectedPersonalItems.length} of {personalInfoItems.length} items selected
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Select personal info by bureau */}
                          {['transunion', 'experian', 'equifax'].map((bureau) => {
                            const bureauItems = personalInfoItems.filter(p => p.bureau === bureau);
                            if (bureauItems.length === 0) return null;
                            const allSelected = bureauItems.every(p => selectedPersonalItems.includes(p.id));
                            return (
                              <Button
                                key={bureau}
                                variant={allSelected ? 'secondary' : 'outline'}
                                size="sm"
                                onClick={() => {
                                  if (allSelected) {
                                    const idsToRemove = bureauItems.map(p => p.id);
                                    setSelectedPersonalItems(prev => prev.filter(id => !idsToRemove.includes(id)));
                                  } else {
                                    const newIds = bureauItems.map(p => p.id);
                                    setSelectedPersonalItems(prev => [...new Set([...prev, ...newIds])]);
                                  }
                                }}
                              >
                                {bureau.charAt(0).toUpperCase() + bureau.slice(1)}
                                <span className="ml-1 text-xs opacity-70">({bureauItems.length})</span>
                              </Button>
                            );
                          })}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (selectedPersonalItems.length === personalInfoItems.length) {
                                setSelectedPersonalItems([]);
                              } else {
                                setSelectedPersonalItems(personalInfoItems.map(p => p.id));
                              }
                            }}
                          >
                            {selectedPersonalItems.length === personalInfoItems.length ? 'Deselect All' : 'Select All'}
                          </Button>
                        </div>
                      </div>

                      {personalInfoItems.map(item => {
                        const isSelected = selectedPersonalItems.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            className={`rounded-lg border p-4 cursor-pointer transition ${
                              isSelected ? 'border-secondary bg-secondary/10' : 'border-border hover:border-secondary/50'
                            }`}
                            onClick={() => {
                              setSelectedPersonalItems(prev => prev.includes(item.id)
                                ? prev.filter(id => id !== item.id)
                                : [...prev, item.id]);
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium">{formatPersonalInfoType(item.type)}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    item.bureau === 'transunion' ? 'bg-blue-500/20 text-blue-400' :
                                    item.bureau === 'experian' ? 'bg-purple-500/20 text-purple-400' :
                                    'bg-green-500/20 text-green-400'
                                  }`}>
                                    {item.bureau === 'transunion' ? 'TransUnion' : item.bureau === 'experian' ? 'Experian' : 'Equifax'}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{item.value}</p>
                              </div>
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected ? 'border-secondary bg-secondary' : 'border-muted-foreground/30'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-primary" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {activeTab === 'inquiries' && (
                <>
                  {loadingItems ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                    </div>
                  ) : inquiryItems.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No inquiries available for dispute.</p>
                      <p className="text-sm text-muted-foreground mt-1">Upload and parse a report to pull inquiry history.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <span className="text-sm text-muted-foreground">
                          {selectedInquiryItems.length} of {inquiryItems.length} inquiries selected
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Select inquiries by bureau */}
                          {['transunion', 'experian', 'equifax'].map((bureau) => {
                            const bureauItems = inquiryItems.filter(i => i.bureau === bureau);
                            if (bureauItems.length === 0) return null;
                            const allSelected = bureauItems.every(i => selectedInquiryItems.includes(i.id));
                            return (
                              <Button
                                key={bureau}
                                variant={allSelected ? 'secondary' : 'outline'}
                                size="sm"
                                onClick={() => {
                                  if (allSelected) {
                                    const idsToRemove = bureauItems.map(i => i.id);
                                    setSelectedInquiryItems(prev => prev.filter(id => !idsToRemove.includes(id)));
                                  } else {
                                    const newIds = bureauItems.map(i => i.id);
                                    setSelectedInquiryItems(prev => [...new Set([...prev, ...newIds])]);
                                  }
                                }}
                              >
                                {bureau.charAt(0).toUpperCase() + bureau.slice(1)}
                                <span className="ml-1 text-xs opacity-70">({bureauItems.length})</span>
                              </Button>
                            );
                          })}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (selectedInquiryItems.length === inquiryItems.length) {
                                setSelectedInquiryItems([]);
                              } else {
                                setSelectedInquiryItems(inquiryItems.map(i => i.id));
                              }
                            }}
                          >
                            {selectedInquiryItems.length === inquiryItems.length ? 'Deselect All' : 'Select All'}
                          </Button>
                        </div>
                      </div>

                      {inquiryItems.map(item => {
                        const isSelected = selectedInquiryItems.includes(item.id);
                        const bureauLabel = item.bureau ? item.bureau.charAt(0).toUpperCase() + item.bureau.slice(1) : 'All Bureaus';
                        const inquiryDate = item.inquiry_date ? new Date(item.inquiry_date).toLocaleDateString() : 'Unknown date';
                        return (
                          <div
                            key={item.id}
                            className={`rounded-lg border p-4 cursor-pointer transition ${
                              isSelected ? 'border-secondary bg-secondary/10' : 'border-border hover:border-secondary/50'
                            }`}
                            onClick={() => {
                              setSelectedInquiryItems(prev => prev.includes(item.id)
                                ? prev.filter(id => id !== item.id)
                                : [...prev, item.id]);
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium">{item.creditor_name}</p>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    item.bureau === 'transunion' ? 'bg-blue-500/20 text-blue-400' :
                                    item.bureau === 'experian' ? 'bg-purple-500/20 text-purple-400' :
                                    item.bureau === 'equifax' ? 'bg-green-500/20 text-green-400' : 'bg-muted/50 text-muted-foreground'
                                  }`}>
                                    {item.bureau ? bureauLabel : 'All bureaus'}
                                  </span>
                                  {item.is_past_fcra_limit && (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                                      FCRA violation
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {inquiryDate} {item.inquiry_type ? `• ${item.inquiry_type}` : ''}
                                </p>
                                {item.days_since_inquiry !== undefined && item.days_since_inquiry !== null && (
                                  <p className="text-xs text-muted-foreground">{item.days_since_inquiry} days old</p>
                                )}
                              </div>
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected ? 'border-secondary bg-secondary' : 'border-muted-foreground/30'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-primary" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Round & Target */}
        {currentStep === 3 && (
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>
                Select Dispute Round & Target
                <span className="text-red-600 dark:text-red-400 ml-1">*</span>
                {selectedBureaus.length === 0 && (
                  <span className="text-xs text-red-600 dark:text-red-400 ml-3 font-normal">
                    (Select at least one bureau)
                  </span>
                )}
              </CardTitle>
              <CardDescription>Configure the dispute round and recipients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderValidationMessages()}
              {/* Discrepancy guardrail */}
              {loadingDiscrepancies ? (
                <div className="p-3 rounded-lg bg-muted/40 border border-border/50 text-sm text-muted-foreground">
                  Checking for bureau discrepancies...
                </div>
              ) : discrepancySummary?.highSeverity ? (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-200">
                  {discrepancySummary.highSeverity} high-severity discrepancies must be resolved before generating letters.
                  Resolve them in the Discrepancies panel, then refresh.
                </div>
              ) : discrepancySummary ? (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-200">
                  No blocking discrepancies detected. ({discrepancySummary.total} total open discrepancies)
                </div>
              ) : null}

              {targetRecipient !== 'bureau' && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-100">
                  Enhanced creditor/furnisher letters enabled. This escalation will cite prior verification attempts and request direct investigation from the data furnisher.
                </div>
              )}
              {/* Round Selection */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Dispute Round</label>
                <div className="space-y-2">
                  {[
                    { round: 1, label: 'Round 1 - Bureau Disputes', desc: 'Initial dispute sent to credit bureaus' },
                    { round: 2, label: 'Round 2 - Direct to Creditor/Furnisher', desc: 'Escalation after bureau verification' },
                    { round: 3, label: 'Round 3+ - Advanced Escalation', desc: 'Collector / CFPB Complaint / Legal' },
                  ].map(({ round, label, desc }) => (
                    <div
                      key={round}
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        disputeRound === round
                          ? 'border-secondary bg-secondary/10'
                          : 'border-border hover:border-secondary/50'
                      }`}
                      onClick={() => {
                        setDisputeRound(round);
                        if (round === 1) setTargetRecipient('bureau');
                        else if (round === 2) setTargetRecipient('creditor');
                        else setTargetRecipient('collector');
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          disputeRound === round
                            ? 'border-secondary bg-secondary'
                            : 'border-muted-foreground/30'
                        }`} />
                        <div>
                          <p className="font-medium">{label}</p>
                          <p className="text-sm text-muted-foreground">{desc}</p>
                        </div>
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
                    <button
                      onClick={() => setSelectedMethodology(recommendedMethodology)}
                      className="text-xs text-secondary hover:underline"
                    >
                      Use recommended: {methodologies.find(m => m.code === recommendedMethodology)?.name}
                    </button>
                  )}
                </div>
                {loadingMethodologies ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-secondary" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {methodologies
                      .filter(m => m.roundRange.includes(disputeRound))
                      .map((methodology) => (
                        <div
                          key={methodology.code}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedMethodology === methodology.code
                              ? 'border-secondary bg-secondary/10'
                              : 'border-border hover:border-secondary/50'
                          }`}
                          onClick={() => setSelectedMethodology(methodology.code)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0 ${
                              selectedMethodology === methodology.code
                                ? 'border-secondary bg-secondary'
                                : 'border-muted-foreground/30'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{methodology.name}</p>
                                {recommendedMethodology === methodology.code && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                                    Recommended
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {methodology.description}
                              </p>
                              {methodology.bestFor.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {methodology.bestFor.slice(0, 2).map((use, i) => (
                                    <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                      {use}
                                    </span>
                                  ))}
                                  {methodology.bestFor.length > 2 && (
                                    <span className="text-xs text-muted-foreground">
                                      +{methodology.bestFor.length - 2} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* e-OSCAR Bypass Option */}
              <div className="space-y-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="requestManualReview"
                    checked={requestManualReview}
                    onChange={(e) => setRequestManualReview(e.target.checked)}
                    className="mt-1 w-4 h-4 cursor-pointer"
                  />
                  <div className="flex-1">
                    <label htmlFor="requestManualReview" className="text-sm font-medium cursor-pointer">
                      Request Manual Review (Bypass e-OSCAR)
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Includes explicit language requesting that this dispute NOT be processed solely through automated e-OSCAR systems and demanding human investigator review. This significantly improves chances of proper investigation in complex cases.
                    </p>
                    <p className="text-xs text-blue-400 mt-2">
                      <strong>Recommended for:</strong> Cases with evidence, identity theft claims, or complex disputed facts
                    </p>
                  </div>
                </div>
              </div>

              {/* Bureau Selection (for Round 1) */}
              {targetRecipient === 'bureau' && (
                <div className="space-y-3">
                  <label className="text-sm font-medium">Select Credit Bureaus</label>
                  <div className="flex flex-wrap gap-3">
                    {BUREAUS.map((bureau) => (
                      <Button
                        key={bureau.code}
                        variant={selectedBureaus.includes(bureau.code) ? 'secondary' : 'outline'}
                        onClick={() => handleToggleBureau(bureau.code)}
                      >
                        {selectedBureaus.includes(bureau.code) && <Check className="w-4 h-4 mr-2" />}
                        {bureau.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Generation Method */}
              <div className="space-y-3">
                <label className="text-sm font-medium">Letter Generation Method</label>
                <div className="flex gap-3">
                  <Button
                    variant={generationMethod === 'ai' ? 'secondary' : 'outline'}
                    className="flex-1"
                    onClick={() => setGenerationMethod('ai')}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI-Generated (Unique)
                  </Button>
                  <Button
                    variant={generationMethod === 'template' ? 'secondary' : 'outline'}
                    className="flex-1"
                    onClick={() => setGenerationMethod('template')}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Template-Based
                  </Button>
                </div>
                {/* AI Mode Info */}
                {generationMethod === 'ai' && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-green-600 dark:text-green-400">AI Analysis Mode</p>
                        <p className="text-muted-foreground mt-1">
                          The AI will automatically analyze your selected items using Metro 2 compliance knowledge to:
                        </p>
                        <ul className="text-muted-foreground mt-1 space-y-0.5 text-xs list-disc list-inside">
                          <li>Identify the best dispute methodology</li>
                          <li>Detect Metro 2 field violations</li>
                          <li>Select appropriate reason codes</li>
                          <li>Generate unique, FCRA-compliant letters</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Combined Letters Option */}
              {targetRecipient === 'bureau' && (selectedItems.length + selectedPersonalItems.length + selectedInquiryItems.length) > 1 && (
                <div className="space-y-3">
                  <label className="text-sm font-medium">Letter Format</label>
                  <div className="space-y-2">
                    <div
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        combineItemsPerBureau
                          ? 'border-secondary bg-secondary/10'
                          : 'border-border hover:border-secondary/50'
                      }`}
                      onClick={() => setCombineItemsPerBureau(true)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          combineItemsPerBureau
                            ? 'border-secondary bg-secondary'
                            : 'border-muted-foreground/30'
                        }`} />
                        <div>
                          <p className="font-medium">Combined Letter per Bureau (Recommended)</p>
                          <p className="text-sm text-muted-foreground">
                            {(selectedItems.length + selectedPersonalItems.length + selectedInquiryItems.length)} items combined into {selectedBureaus.length} letter(s) - one per bureau
                          </p>
                        </div>
                      </div>
                    </div>
                    <div
                      className={`p-4 rounded-lg border cursor-pointer transition-all ${
                        !combineItemsPerBureau
                          ? 'border-secondary bg-secondary/10'
                          : 'border-border hover:border-secondary/50'
                      }`}
                      onClick={() => setCombineItemsPerBureau(false)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          !combineItemsPerBureau
                            ? 'border-secondary bg-secondary'
                            : 'border-muted-foreground/30'
                        }`} />
                        <div>
                          <p className="font-medium">Individual Letter per Item</p>
                          <p className="text-sm text-muted-foreground">
                            {(selectedItems.length + selectedPersonalItems.length + selectedInquiryItems.length) * selectedBureaus.length} separate letters - one per item per bureau
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Evidence Picker */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    Evidence Attachments (Enclosures)
                  </label>
                  <span className="text-xs text-muted-foreground">
                    {selectedEvidenceIds.length} selected
                  </span>
                </div>
                
                {loadingEvidence ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-secondary" />
                  </div>
                ) : evidenceDocuments.length === 0 ? (
                  <div className="p-3 rounded-lg bg-muted/50 text-center text-sm text-muted-foreground">
                    <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No documents uploaded for this client.</p>
                    <p className="text-xs mt-1">Standard enclosures (ID, proof of address) will be included automatically.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {evidenceDocuments.map((doc) => {
                      const isSelected = selectedEvidenceIds.includes(doc.id);
                      return (
                        <div
                          key={doc.id}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-secondary bg-secondary/10'
                              : 'border-border hover:border-secondary/50'
                          }`}
                          onClick={() => {
                            setSelectedEvidenceIds(prev =>
                              isSelected
                                ? prev.filter(id => id !== doc.id)
                                : [...prev, doc.id]
                            );
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              isSelected
                                ? 'border-secondary bg-secondary'
                                : 'border-muted-foreground/30'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-primary" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{doc.file_name}</p>
                              <p className="text-xs text-muted-foreground">{doc.file_type}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                {/* High-risk evidence warning */}
                {selectedReasonCodes.some(c => ['identity_theft', 'not_mine', 'never_late', 'mixed_file'].includes(c)) && 
                 selectedEvidenceIds.length === 0 && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                          Evidence Required for High-Risk Claims
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          The selected reason codes require supporting documentation. Please attach evidence or confirm override.
                        </p>
                        <label className="flex items-center gap-2 mt-2">
                          <input
                            type="checkbox"
                            checked={evidenceOverrideConfirmed}
                            onChange={(e) => setEvidenceOverrideConfirmed(e.target.checked)}
                            className="rounded border-yellow-500"
                          />
                          <span className="text-xs text-yellow-600 dark:text-yellow-400">
                            I confirm client has provided verbal verification of these claims
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Upload Evidence Button */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowEvidenceUploadModal(true)}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Evidence Documents
                </Button>

                {/* AI Analysis Settings - Confidence Filtering & Aggressiveness (AI mode only) */}
                {generationMethod === 'ai' && (
                  <div data-analysis-settings className="space-y-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-blue-900 dark:text-blue-200">
                        Analysis Settings
                      </label>
                      <button
                        onClick={() => setShowLowConfidenceItems(!showLowConfidenceItems)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {showLowConfidenceItems ? 'Hide' : 'Show'} Low Confidence Items
                      </button>
                    </div>

                    {/* Confidence Threshold Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Minimum Confidence Threshold</span>
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {Math.round(confidenceThreshold * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={confidenceThreshold}
                        onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                        className="w-full h-2 bg-blue-200 dark:bg-blue-900 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Low</span>
                        <span>High</span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground italic">
                      Adjust the threshold to filter recommendations. Higher threshold = only highest-confidence items.
                    </p>

                    {/* P3.4: Analysis Aggressiveness Selector */}
                    <div className="border-t border-blue-200 dark:border-blue-900 pt-3 mt-3">
                      <p className="text-xs font-medium text-blue-900 dark:text-blue-200 mb-2">Analysis Aggressiveness</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(['conservative', 'balanced', 'aggressive'] as const).map((level) => (
                          <button
                            key={level}
                            onClick={() => setAnalysisAggressiveness(level)}
                            className={`px-3 py-2 rounded text-xs font-medium transition-all ${
                              analysisAggressiveness === level
                                ? level === 'conservative'
                                  ? 'bg-blue-600 dark:bg-blue-500 text-white'
                                  : level === 'balanced'
                                    ? 'bg-blue-500 dark:bg-blue-600 text-white'
                                    : 'bg-red-600 dark:bg-red-500 text-white'
                                : 'bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-100 hover:bg-blue-300 dark:hover:bg-blue-800'
                            }`}
                          >
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-2 italic">
                        {analysisAggressiveness === 'conservative'
                          ? 'Conservative: Finds only the strongest violations'
                          : analysisAggressiveness === 'balanced'
                            ? 'Balanced: Balanced strength and comprehensiveness'
                            : 'Aggressive: Finds all potential violations (may be less precise)'}
                      </p>
                    </div>

                    {/* Save Preferences Button */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={saveAnalysisPreferences}
                        className="flex-1 text-xs"
                      >
                        {analysisPreferencesSaved ? '✓ Saved' : 'Save Preferences'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Review (Both AI and Template Mode) */}
        {currentStep === 4 && (
          <div className="space-y-4">
            {renderValidationMessages()}
            {/* AI Analysis Summary (AI mode only) */}
            {generationMethod === 'ai' && aiAnalysisSummary && (
              <Card className="bg-card/80 backdrop-blur-sm border-border/50 border-l-4 border-l-green-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-green-500" />
                    AI Analysis Summary
                  </CardTitle>
                  <CardDescription>
                    <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
                      <span>Metro 2 compliance analysis complete</span>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-xs">{Math.round(aiAnalysisSummary.averageConfidence * 100)}% avg</span>
                        </div>
                        {aiAnalysisResults.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {aiAnalysisResults.filter(r => r.confidence >= confidenceThreshold).length}/{aiAnalysisResults.length} meet threshold
                          </span>
                        )}
                      </div>
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-muted-foreground">Items Analyzed</p>
                      <p className="font-semibold">{aiAnalysisSummary.itemCount}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-muted-foreground">Methodology</p>
                      <p className="font-semibold capitalize">{aiAnalysisSummary.recommendedMethodology.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-muted-foreground">Reason Codes</p>
                      <p className="font-semibold">{aiAnalysisSummary.allReasonCodes.length}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-muted-foreground">Violations Found</p>
                      <p className="font-semibold">{aiAnalysisSummary.allMetro2Violations.length}</p>
                    </div>
                  </div>

                  {/* Confidence Breakdown */}
                  {aiAnalysisResults.length > 0 && (
                    <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Confidence Breakdown</p>
                      <div className="space-y-1">
                        {[
                          { range: [0.8, 1.0], label: 'Very High', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/20' },
                          { range: [0.6, 0.8], label: 'High', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/20' },
                          { range: [0.4, 0.6], label: 'Medium', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-950/20' },
                          { range: [0, 0.4], label: 'Low', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/20' },
                        ].map(({ range, label, color, bg }) => {
                          const count = aiAnalysisResults.filter(r => r.confidence >= range[0] && r.confidence < range[1]).length;
                          return (
                            <div key={label} className="flex items-center justify-between text-xs">
                              <span className={`inline-flex items-center px-2 py-1 rounded ${bg}`}>
                                <span className={`w-2 h-2 rounded-full ${color} mr-1`}></span>
                                <span>{label}: {count} item{count !== 1 ? 's' : ''}</span>
                              </span>
                              <span className={`${color} font-medium`}>{Math.round((count / aiAnalysisResults.length) * 100)}%</span>
                            </div>
                          );
                        })}
                      </div>
                      {aiAnalysisResults.filter(r => r.confidence < confidenceThreshold).length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          {aiAnalysisResults.filter(r => r.confidence < confidenceThreshold).length} item(s) below current threshold ({Math.round(confidenceThreshold * 100)}%)
                        </p>
                      )}
                    </div>
                  )}
                  {aiAnalysisSummary.allMetro2Violations.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      <p className="font-medium mb-1">Metro 2 Violations Identified:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {aiAnalysisSummary.allMetro2Violations.slice(0, 3).map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                        {aiAnalysisSummary.allMetro2Violations.length > 3 && (
                          <li>+{aiAnalysisSummary.allMetro2Violations.length - 3} more violations</li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* P3.4: Re-analyze with Different Settings Button */}
                  <div className="pt-3 border-t border-border/50 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCurrentStep(3);
                        // Scroll to Analysis Settings
                        setTimeout(() => {
                          const settingsElement = document.querySelector('[data-analysis-settings]');
                          if (settingsElement) {
                            settingsElement.scrollIntoView({ behavior: 'smooth' });
                          }
                        }, 100);
                      }}
                      className="flex-1"
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Re-analyze with Different Settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* P3.6: Letter Strength Score Card (AI mode only) */}
            {generationMethod === 'ai' && aiAnalysisResults.length > 0 && (
              <>
                {/* P3.6: Calculate and display letter strength score */}
                {(() => {
                  const strength = calculateLetterStrength(
                    aiAnalysisResults,
                    selectedEvidenceIds.length > 0,
                    selectedEvidenceIds.length,
                    disputeRound,
                    aiAnalysisSummary?.recommendedMethodology || 'factual'
                  );
                  return strength && (
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50 border-l-4 border-l-purple-500">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        Letter Strength Score
                      </CardTitle>
                      <CardDescription>
                        Overall quality assessment of the dispute letters
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Overall Score Display */}
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <div className="text-5xl font-bold text-purple-600 dark:text-purple-400">
                            {strength.overallScore}
                          </div>
                          <p className="text-sm text-muted-foreground">/10</p>
                        </div>
                        <div className="flex-1">
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                            <div
                              className="bg-gradient-to-r from-purple-500 to-purple-600 h-full rounded-full transition-all duration-300"
                              style={{ width: `${(strength.overallScore / 10) * 100}%` }}
                            />
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            {strength.overallScore >= 8 ? 'Excellent - Strong dispute' : strength.overallScore >= 6 ? 'Good - Solid dispute' : 'Fair - Consider improvements'}
                          </p>
                        </div>
                      </div>

                      {/* Score Breakdown */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        <div className="p-2 rounded bg-muted/50">
                          <p className="text-muted-foreground text-xs">Violations</p>
                          <p className="font-semibold">{strength.violationScore.toFixed(1)}/3</p>
                        </div>
                        <div className="p-2 rounded bg-muted/50">
                          <p className="text-muted-foreground text-xs">Citations</p>
                          <p className="font-semibold">{strength.citationScore.toFixed(1)}/2</p>
                        </div>
                        <div className="p-2 rounded bg-muted/50">
                          <p className="text-muted-foreground text-xs">Evidence</p>
                          <p className="font-semibold">{strength.evidenceScore.toFixed(1)}/1.5</p>
                        </div>
                        <div className="p-2 rounded bg-muted/50">
                          <p className="text-muted-foreground text-xs">Confidence</p>
                          <p className="font-semibold">{strength.confidenceScore.toFixed(1)}/1.5</p>
                        </div>
                        <div className="p-2 rounded bg-muted/50">
                          <p className="text-muted-foreground text-xs">Escalation</p>
                          <p className="font-semibold">{strength.escalationScore.toFixed(1)}/1</p>
                        </div>
                        <div className="p-2 rounded bg-muted/50">
                          <p className="text-muted-foreground text-xs">Methodology</p>
                          <p className="font-semibold">{strength.methodologyScore.toFixed(1)}/1</p>
                        </div>
                      </div>

                      {/* Suggestions */}
                      {strength.suggestions.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-border/50">
                          <p className="text-sm font-medium text-muted-foreground">Improvement Suggestions:</p>
                          <ul className="space-y-1">
                            {strength.suggestions.map((suggestion, idx) => (
                              <li key={idx} className="text-sm text-muted-foreground flex gap-2">
                                <span className="text-blue-600 dark:text-blue-400">•</span>
                                <span>{suggestion}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  );
                })()}
              </>
            )}

            {/* Bulk Actions Card */}
            <Card className="bg-card/80 backdrop-blur-sm border-border/50 border-l-4 border-l-secondary">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Mark Disputes as Sent</CardTitle>
                <CardDescription>
                  After mailing your letters, enter tracking info to start the 30-day response deadline
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Tracking Number (Optional)</label>
                    <Input
                      placeholder="e.g., 9400111899223100034012"
                      value={bulkTrackingNumber}
                      onChange={(e) => setBulkTrackingNumber(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">USPS Certified Mail tracking number</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Send Date</label>
                    <Input
                      type="date"
                      value={bulkSendDate}
                      onChange={(e) => setBulkSendDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Defaults to today if not set</p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleBulkMarkAsSent}
                  disabled={markingAsSent || generatedLetters.length === 0}
                >
                  {markingAsSent ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving Disputes...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Mark All {generatedLetters.length} Disputes as Sent
                    </>
                  )}
                </Button>
                {bulkSentSuccess && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-500 text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Successfully saved {generatedLetters.length} disputes. Response deadline set for 30 days.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle>Generated Letters</CardTitle>
                <CardDescription>
                  {generatedLetters.length} letters generated for review
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {generatedLetters.map((letter, index) => {
                  const payloadItems = letter.items && letter.items.length > 0
                    ? letter.items
                    : [];
                  const primaryItem = payloadItems[0];

                  const formatPayloadLabel = (payload: DisputeItemPayload) => {
                    if (payload.kind === 'personal') {
                      const type = payload.itemType?.replace('personal_info_', '') || 'personal info';
                      return `${formatPersonalInfoType(type)} - ${payload.value || ''}`;
                    }
                    if (payload.kind === 'inquiry') {
                      const date = payload.inquiryDate ? new Date(payload.inquiryDate).toLocaleDateString() : '';
                      return `${payload.creditorName || 'Inquiry'}${date ? ` (${date})` : ''}`;
                    }
                    return `${payload.creditorName || 'Tradeline'}${payload.amount ? ` • ${formatCurrency(payload.amount)}` : ''}`;
                  };
                  
                  return (
                    <div key={index} className="border border-border rounded-lg overflow-hidden">
                      <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
                        <div>
                          {letter.combined ? (
                            <>
                              <p className="font-medium flex items-center gap-2">
                                <span className="px-2 py-0.5 text-xs bg-secondary/20 text-secondary rounded">
                                  Combined
                                </span>
                                {letter.bureau.charAt(0).toUpperCase() + letter.bureau.slice(1)} - {payloadItems.length} Item(s)
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {payloadItems.map((p) => formatPayloadLabel(p)).join(', ')}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="font-medium flex items-center gap-2">
                                {primaryItem?.kind === 'tradeline' && (
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    primaryItem?.riskSeverity === 'severe' ? 'bg-red-500/20 text-red-400' :
                                    primaryItem?.riskSeverity === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                    primaryItem?.riskSeverity === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-green-500/20 text-green-400'
                                  }`}>
                                    {primaryItem?.riskSeverity || 'unknown'}
                                  </span>
                                )}
                                {formatPayloadLabel(primaryItem || { id: '', kind: 'tradeline' })}
                                <span className="text-xs text-muted-foreground">
                                  ({letter.bureau.charAt(0).toUpperCase() + letter.bureau.slice(1)})
                                </span>
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {primaryItem?.itemType ? formatItemType(primaryItem.itemType) : ''}
                              </p>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(letter.content)}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadLetter(
                              letter.content,
                              letter.combined
                                ? `dispute-${letter.bureau}-combined-${payloadItems.length}-items.txt`
                                : `dispute-${letter.bureau}-${primaryItem?.creditorName || 'item'}.txt`
                            )}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                      <div className="p-4 max-h-[400px] overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-sm font-mono">{letter.content}</pre>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Evidence Preview Card */}
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="w-5 h-5" />
                  Evidence Documentation
                </CardTitle>
                <CardDescription>
                  {selectedEvidenceIds.length === 0
                    ? 'No evidence attached to this dispute'
                    : `${selectedEvidenceIds.length} document(s) attached`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedEvidenceIds.length === 0 ? (
                  <div className="p-4 rounded-lg bg-muted/50 text-center text-sm text-muted-foreground">
                    <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No evidence documents selected for this dispute.</p>
                    <p className="text-xs mt-2">
                      Evidence significantly strengthens disputes, especially for high-risk claims.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setShowEvidenceUploadModal(true)}
                    >
                      <Upload className="w-3 h-3 mr-1" />
                      Add Evidence
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {evidenceDocuments
                      .filter((doc) => selectedEvidenceIds.includes(doc.id))
                      .map((doc) => (
                        <motion.div
                          key={doc.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                {doc.file_name}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Attached on {new Date(doc.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveEvidence(doc.id)}
                            className="text-muted-foreground hover:text-red-600"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </motion.div>
                      ))}

                    {selectedEvidenceIds.length < evidenceDocuments.length && (
                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                        <p className="text-xs text-blue-900 dark:text-blue-200">
                          <strong>{evidenceDocuments.length - selectedEvidenceIds.length} more document(s)</strong> available for selection.
                          Go back to Step 3 to add additional evidence.
                        </p>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowEvidenceUploadModal(true)}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Additional Evidence
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </motion.div>

      {/* Navigation Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex items-center justify-between"
      >
        <Button
          variant="outline"
          onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
          disabled={currentStep === 1}
          title="Keyboard shortcut: Escape"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
          <span className="hidden sm:inline ml-2 text-xs text-muted-foreground">(Esc)</span>
        </Button>

        {/* Both modes: Step 3 triggers generation, Step 4 is Review */}
        {currentStep === 3 ? (
          <Button
            onClick={async () => {
              if (!validateCurrentStep()) return;
              let analysisData = null;
              if (generationMethod === 'ai') {
                // AI mode: First analyze items with AI, then pass the data directly to generateLetters
                // This avoids React state timing issues where state updates haven't applied yet
                analysisData = await analyzeItemsWithAI();
              }
              await generateLetters(analysisData);
            }}
            disabled={!canProceed() || generating || analyzingItems}
          >
            {analyzingItems ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analyzing Items... ({Math.round(analysisProgress)}%)
                {estimatedTimeRemaining !== null && estimatedTimeRemaining > 0 && (
                  <span className="ml-2 text-xs opacity-75">~{estimatedTimeRemaining}s</span>
                )}
              </>
            ) : generating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating ({generationProgress}%)
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {generationMethod === 'ai' ? 'Analyze & Generate' : 'Generate Letters'}
              </>
            )}
          </Button>
        ) : currentStep === 4 ? (
          <Button onClick={() => router.push('/admin/clients')}>
            <CheckCircle className="w-4 h-4 mr-2" />
            Done
          </Button>
        ) : (
          <Button
            onClick={() => {
              if (!validateCurrentStep()) return;
              setCurrentStep(prev => Math.min(maxSteps, prev + 1));
            }}
            disabled={!canProceed()}
            title="Keyboard shortcut: Enter"
          >
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
            <span className="hidden sm:inline ml-2 text-xs">(↵)</span>
          </Button>
        )}
      </motion.div>
    </div>
  );
}

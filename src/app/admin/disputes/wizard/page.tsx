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
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
}

interface NegativeItem {
  id: string;
  creditor_name: string;
  original_creditor: string | null;
  item_type: string;
  amount: number | null;
  date_reported: string | null;
  bureau: string | null;
  risk_severity: string;
  recommended_action: string | null;
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

export default function DisputeWizardPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);

  // Step 1 - Client Selection
  const [clients, setClients] = React.useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [clientSearch, setClientSearch] = React.useState('');
  const [loadingClients, setLoadingClients] = React.useState(false);

  // Step 2 - Item Selection
  const [negativeItems, setNegativeItems] = React.useState<NegativeItem[]>([]);
  const [selectedItems, setSelectedItems] = React.useState<string[]>([]);
  const [loadingItems, setLoadingItems] = React.useState(false);
  
  // Per-item dispute instructions (for template mode)
  const [itemDisputeInstructions, setItemDisputeInstructions] = React.useState<Map<string, ItemDisputeInstruction>>(new Map());

  // Step 3 - Round & Target
  const [disputeRound, setDisputeRound] = React.useState(1);
  const [targetRecipient, setTargetRecipient] = React.useState<'bureau' | 'creditor' | 'collector'>('bureau');
  const [selectedBureaus, setSelectedBureaus] = React.useState<string[]>(['transunion', 'experian', 'equifax']);
  const [generationMethod, setGenerationMethod] = React.useState<'ai' | 'template'>('ai');
  const [combineItemsPerBureau, setCombineItemsPerBureau] = React.useState(true);
  
  // NEW: Methodology Selection
  const [methodologies, setMethodologies] = React.useState<Methodology[]>([]);
  const [selectedMethodology, setSelectedMethodology] = React.useState<string>('factual');
  const [recommendedMethodology, setRecommendedMethodology] = React.useState<string | null>(null);
  const [loadingMethodologies, setLoadingMethodologies] = React.useState(false);

  // AI Analysis Results (used when generationMethod === 'ai')
  const [aiAnalysisResults, setAiAnalysisResults] = React.useState<AIAnalysisResult[]>([]);
  const [aiAnalysisSummary, setAiAnalysisSummary] = React.useState<AIAnalysisSummary | null>(null);
  const [analyzingItems, setAnalyzingItems] = React.useState(false);

  // Both modes use 4 steps now
  const maxSteps = WIZARD_STEPS.length;
  const reviewStepId = 4;

  // Legacy reason codes state (kept for backward compatibility, but not used in new flow)
  const [reasonCodes, setReasonCodes] = React.useState<ReasonCode[]>([]);
  const [disputeTypes, setDisputeTypes] = React.useState<DisputeType[]>([]);
  const [selectedReasonCodes, setSelectedReasonCodes] = React.useState<string[]>([]);
  const [selectedDisputeType, setSelectedDisputeType] = React.useState('standard');
  const [customReason, setCustomReason] = React.useState('');

  // Step 5 - Generated Letters
  const [generatedLetters, setGeneratedLetters] = React.useState<Array<{
    bureau: string;
    itemId: string;
    itemIds?: string[]; // For combined letters
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
      }
    } catch (error) {
      console.error('Error fetching negative items:', error);
    } finally {
      setLoadingItems(false);
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

  // Analyze items with AI (auto-determine dispute strategy)
  // Returns the analysis data directly to avoid React state timing issues
  const analyzeItemsWithAI = async (): Promise<{ analyses: AIAnalysisResult[]; summary: AIAnalysisSummary } | null> => {
    if (selectedItems.length === 0) return null;
    
    setAnalyzingItems(true);
    try {
      const response = await fetch('/api/admin/disputes/analyze-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds: selectedItems,
          round: disputeRound,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const analyses = data.analyses || [];
        const summary = data.summary || null;
        
        // Update state for UI display
        setAiAnalysisResults(analyses);
        setAiAnalysisSummary(summary);
        
        // Auto-select the recommended methodology
        if (summary?.recommendedMethodology) {
          setSelectedMethodology(summary.recommendedMethodology);
        }
        
        // Return the data directly to avoid state timing issues
        return { analyses, summary };
      }
      return null;
    } catch (error) {
      console.error('Error analyzing items:', error);
      return null;
    } finally {
      setAnalyzingItems(false);
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
  }, [fetchClients]);

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
    }
  }, [selectedClient]);

  // Generate letters
  // Accepts optional analysis data to avoid React state timing issues
  const generateLetters = async (analysisData?: { analyses: AIAnalysisResult[]; summary: AIAnalysisSummary } | null) => {
    if (!selectedClient || selectedItems.length === 0) {
      return;
    }

    // Use passed analysis data or fall back to state (for non-AI mode or re-generation)
    const effectiveAnalyses = analysisData?.analyses || aiAnalysisResults;
    const effectiveSummary = analysisData?.summary || aiAnalysisSummary;

    // For AI mode, we use AI analysis; for template mode, we use per-item instructions
    const reasonCodesToUse = generationMethod === 'ai' 
      ? (effectiveSummary?.allReasonCodes || ['verification_required', 'inaccurate_reporting'])
      : []; // Template mode now uses per-item instructions

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

    // Combined letter mode: one letter per bureau with all selected items
    if (combineItemsPerBureau && targetRecipient === 'bureau') {
      const totalLetters = bureausToUse.length;
      let completed = 0;

      for (const bureau of bureausToUse) {
        try {
          const response = await fetch('/api/admin/disputes/generate-letter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              clientId: selectedClient.id,
              negativeItemIds: selectedItems,
              bureau: bureau,
              disputeType: selectedDisputeType,
              round: disputeRound,
              targetRecipient: targetRecipient,
              reasonCodes: reasonCodesToUse,
              customReason: customReason || undefined,
              combineItems: true,
              methodology: methodologyToUse,
              // Include per-item instructions for template mode
              perItemInstructions: generationMethod === 'template' ? perItemInstructions : undefined,
              // Include AI analysis data for enhanced letters - use effectiveSummary to avoid state timing issues
              metro2Violations: generationMethod === 'ai' ? effectiveSummary?.allMetro2Violations : undefined
            }),
          });

          if (response.ok) {
            const data = await response.json();
            letters.push({
              bureau: bureau,
              itemId: selectedItems[0], // Primary item for reference
              itemIds: selectedItems,
              content: data.letter_content,
              combined: true,
            });
          }
        } catch (error) {
          console.error('Error generating combined letter:', error);
        }

        completed++;
        setGenerationProgress(Math.round((completed / totalLetters) * 100));
      }
    } else {
      // Individual letter mode: one letter per item per bureau (original behavior)
      const totalLetters = selectedItems.length * bureausToUse.length;
      let completed = 0;

      for (const itemId of selectedItems) {
        const item = negativeItems.find(i => i.id === itemId);
        if (!item) continue;

        // Get per-item instruction for template mode
        const itemInstruction = generationMethod === 'template' 
          ? getInstructionText(itemId)
          : undefined;

        for (const bureau of bureausToUse) {
          try {
            const response = await fetch('/api/admin/disputes/generate-letter', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                clientId: selectedClient.id,
                negativeItemId: itemId,
                bureau: targetRecipient === 'bureau' ? bureau : item.bureau || 'transunion',
                disputeType: selectedDisputeType,
                round: disputeRound,
                targetRecipient: targetRecipient,
                reasonCodes: reasonCodesToUse,
                customReason: itemInstruction || customReason || undefined,
                creditorName: item.creditor_name,
                itemType: item.item_type,
                amount: item.amount,
                methodology: methodologyToUse,
                // Include per-item instruction for template mode
                disputeInstruction: itemInstruction,
                // Include AI analysis data for this specific item - use effectiveAnalyses to avoid state timing issues
                metro2Violations: generationMethod === 'ai' 
                  ? effectiveAnalyses.find(a => a.itemId === itemId)?.metro2Violations 
                  : undefined
              }),
            });

            if (response.ok) {
              const data = await response.json();
              letters.push({
                bureau: bureau,
                itemId: itemId,
                content: data.letter_content,
                combined: false,
              });
            }
          } catch (error) {
            console.error('Error generating letter:', error);
          }

          completed++;
          setGenerationProgress(Math.round((completed / totalLetters) * 100));
        }
      }
    }

    setGeneratedLetters(letters);
    setGenerating(false);
    setCurrentStep(reviewStepId); // Go to review step (4 for both modes now)
  };

  const handleSelectClient = (client: Client) => {
    setSelectedClient(client);
    setSelectedItems([]);
    setNegativeItems([]);
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

  const handleToggleReasonCode = (code: string) => {
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
            creditorName: item?.creditor_name,
            accountNumber: item?.amount ? `****${String(item.amount).slice(-4)}` : null,
            generatedByAi: generationMethod === 'ai',
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

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedClient !== null;
      case 2:
        // For template mode, all selected items must have dispute instructions
        if (generationMethod === 'template') {
          const allItemsHaveInstructions = selectedItems.every(itemId => {
            const instruction = itemDisputeInstructions.get(itemId);
            if (!instruction) return false;
            if (instruction.instructionType === 'preset' && instruction.presetCode && instruction.presetCode !== 'custom') return true;
            if (instruction.instructionType === 'custom' && instruction.customText && instruction.customText.trim().length > 0) return true;
            return false;
          });
          return selectedItems.length > 0 && allItemsHaveInstructions;
        }
        // AI mode just needs selected items
        return selectedItems.length > 0;
      case 3:
        // Step 3 is the config step before generation
        return targetRecipient === 'bureau' ? selectedBureaus.length > 0 : true;
      case 4:
        // Step 4 is Review for both modes
        return generatedLetters.length > 0;
      default:
        return false;
    }
  };

  const formatItemType = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const formatCurrency = (cents: number | null) => {
    if (!cents) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
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

  return (
    <div className="space-y-6">
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
            <div className="flex items-center justify-between">
              {WIZARD_STEPS.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div
                    className={`flex items-center gap-3 cursor-pointer transition-colors ${
                      currentStep === step.id
                        ? 'text-secondary'
                        : currentStep > step.id
                        ? 'text-green-500'
                        : 'text-muted-foreground'
                    }`}
                    onClick={() => {
                      if (step.id < currentStep) {
                        setCurrentStep(step.id);
                      }
                    }}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                        currentStep === step.id
                          ? 'border-secondary bg-secondary/10'
                          : currentStep > step.id
                          ? 'border-green-500 bg-green-500/10'
                          : 'border-muted-foreground/30'
                      }`}
                    >
                      {currentStep > step.id ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <step.icon className="w-5 h-5" />
                      )}
                    </div>
                    <span className="hidden sm:block font-medium">{step.name}</span>
                  </div>
                  {index < WIZARD_STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-4 transition-colors ${
                        currentStep > step.id ? 'bg-green-500' : 'bg-muted-foreground/20'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
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
              <CardTitle>Select Client</CardTitle>
              <CardDescription>Choose a client to generate dispute letters for</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  {clients.map((client) => (
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
                          {client.first_name.charAt(0)}{client.last_name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{client.first_name} {client.last_name}</p>
                          <p className="text-sm text-muted-foreground">{client.email}</p>
                        </div>
                        {selectedClient?.id === client.id && (
                          <Check className="w-5 h-5 text-secondary" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Select Items */}
        {currentStep === 2 && (
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Select Negative Items</CardTitle>
              <CardDescription>
                Choose items to dispute for {selectedClient?.first_name} {selectedClient?.last_name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Info box for template mode */}
              {generationMethod === 'template' && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm text-blue-400">
                    <strong>Template Mode:</strong> Select items below and set a dispute instruction for each one. 
                    You can choose from pre-built reasons or enter a custom instruction.
                  </p>
                </div>
              )}
              
              {/* Info box for AI mode */}
              {generationMethod === 'ai' && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-sm text-green-400">
                    <strong>AI Mode:</strong> Simply select items to dispute. The AI will automatically analyze 
                    each item for Metro 2 compliance violations and FCRA issues.
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
                        const bureauItems = negativeItems.filter(i => i.bureau === bureau);
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
                              <div className="flex items-center gap-2">
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
                                {item.bureau && ` • ${item.bureau.charAt(0).toUpperCase() + item.bureau.slice(1)}`}
                              </p>
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
            </CardContent>
          </Card>
        )}

        {/* Step 3: Round & Target */}
        {currentStep === 3 && (
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Select Dispute Round & Target</CardTitle>
              <CardDescription>Configure the dispute round and recipients</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
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
              {targetRecipient === 'bureau' && selectedItems.length > 1 && (
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
                            {selectedItems.length} items combined into {selectedBureaus.length} letter(s) - one per bureau
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
                            {selectedItems.length * selectedBureaus.length} separate letters - one per item per bureau
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 4: Review (Both AI and Template Mode) */}
        {currentStep === 4 && (
          <div className="space-y-4">
            {/* AI Analysis Summary (AI mode only) */}
            {generationMethod === 'ai' && aiAnalysisSummary && (
              <Card className="bg-card/80 backdrop-blur-sm border-border/50 border-l-4 border-l-green-500">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-green-500" />
                    AI Analysis Summary
                  </CardTitle>
                  <CardDescription>
                    Metro 2 compliance analysis complete - {Math.round(aiAnalysisSummary.averageConfidence * 100)}% confidence
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
                </CardContent>
              </Card>
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
                  const item = negativeItems.find(i => i.id === letter.itemId);
                  const allItems = letter.combined && letter.itemIds
                    ? letter.itemIds.map(id => negativeItems.find(i => i.id === id)).filter(Boolean)
                    : [item].filter(Boolean);
                  
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
                                {letter.bureau.charAt(0).toUpperCase() + letter.bureau.slice(1)} - {allItems.length} Account(s)
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {allItems.map((i: typeof item) => i?.creditor_name).join(', ')}
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="font-medium">
                                {item?.creditor_name || 'Unknown'} - {letter.bureau.charAt(0).toUpperCase() + letter.bureau.slice(1)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {formatItemType(item?.item_type || '')}
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
                                ? `dispute-${letter.bureau}-combined-${allItems.length}-accounts.txt`
                                : `dispute-${letter.bureau}-${item?.creditor_name?.replace(/\s+/g, '-')}.txt`
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
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        {/* Both modes: Step 3 triggers generation, Step 4 is Review */}
        {currentStep === 3 ? (
          <Button
            onClick={async () => {
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
                Analyzing Items...
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
            onClick={() => setCurrentStep(prev => Math.min(maxSteps, prev + 1))}
            disabled={!canProceed()}
          >
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </motion.div>
    </div>
  );
}

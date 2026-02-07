// Hook for managing dispute wizard draft persistence and auto-save
import { useCallback, useEffect, useRef, useState } from 'react';

export interface WizardDraftData {
  // Step 1: Client Selection
  selectedClientId?: string | null;
  clientSearch?: string;

  // Step 2: Item Selection
  selectedItems?: string[];
  selectedPersonalItems?: string[];
  selectedInquiryItems?: string[];
  activeTab?: 'tradelines' | 'personal' | 'inquiries';
  itemDisputeInstructions?: Map<string, { itemId: string; instructionType: 'preset' | 'custom'; presetCode?: string; customText?: string }>;

  // Step 3: Configuration
  disputeRound?: number;
  targetRecipient?: 'bureau' | 'creditor' | 'collector';
  selectedBureaus?: string[];
  generationMethod?: 'ai' | 'template';
  combineItemsPerBureau?: boolean;
  selectedMethodology?: string;
  requestManualReview?: boolean;
  selectedEvidenceIds?: string[];

  // Other state
  currentStep?: number;
  selectedReasonCodes?: string[];
}

export interface DraftMetadata {
  draftId: string;
  clientId?: string;
  clientName?: string;
  createdAt: string;
  lastSavedAt: string;
  itemCount: number;
  currentStep: number;
}

const STORAGE_KEY = 'dispute-wizard-draft';
const METADATA_KEY = 'dispute-wizard-metadata';
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

/**
 * Hook for managing dispute wizard draft persistence
 * Handles auto-saving, loading, and clearing drafts
 */
export function useWizardDraft(clientId?: string | null) {
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [draftExists, setDraftExists] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveInProgressRef = useRef(false);

  // Load draft from localStorage on mount
  const loadDraft = useCallback((): WizardDraftData | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const draft = JSON.parse(stored) as WizardDraftData;

      // If clientId is provided, only load draft for same client
      if (clientId && draft.selectedClientId !== clientId) {
        return null;
      }

      setDraftLoaded(true);
      setDraftExists(true);

      // Update last saved time from metadata
      const metadata = localStorage.getItem(METADATA_KEY);
      if (metadata) {
        const meta = JSON.parse(metadata) as DraftMetadata;
        setLastSavedAt(new Date(meta.lastSavedAt));
      }

      return draft;
    } catch (error) {
      console.error('Failed to load draft:', error);
      return null;
    }
  }, [clientId]);

  // Save draft to localStorage and optionally to database
  const saveDraft = useCallback(
    async (data: WizardDraftData, metadata?: Partial<DraftMetadata>) => {
      if (saveInProgressRef.current) return;
      saveInProgressRef.current = true;

      try {
        const now = new Date();
        setLastSavedAt(now);

        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

        // Save metadata
        const draftMetadata: DraftMetadata = {
          draftId: `draft-${clientId || 'unknown'}-${Date.now()}`,
          clientId: data.selectedClientId || clientId || undefined,
          clientName: metadata?.clientName,
          createdAt: metadata?.createdAt || now.toISOString(),
          lastSavedAt: now.toISOString(),
          itemCount: (data.selectedItems?.length || 0) + (data.selectedPersonalItems?.length || 0) + (data.selectedInquiryItems?.length || 0),
          currentStep: data.currentStep || 1,
        };
        localStorage.setItem(METADATA_KEY, JSON.stringify(draftMetadata));

        // Optional: Save to database via API
        try {
          await fetch('/api/admin/disputes/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              draftId: draftMetadata.draftId,
              clientId: draftMetadata.clientId,
              data,
              metadata: draftMetadata,
            }),
          });
        } catch (dbError) {
          console.warn('Failed to save draft to database, continuing with localStorage only:', dbError);
        }
      } catch (error) {
        console.error('Failed to save draft:', error);
      } finally {
        saveInProgressRef.current = false;
      }
    },
    [clientId]
  );

  // Setup auto-save
  const setupAutoSave = useCallback(
    (data: WizardDraftData, metadata?: Partial<DraftMetadata>) => {
      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }

      // Set up new timer
      autoSaveTimerRef.current = setInterval(() => {
        saveDraft(data, metadata);
      }, AUTO_SAVE_INTERVAL);
    },
    [saveDraft]
  );

  // Clear draft
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(METADATA_KEY);
      setDraftExists(false);
      setLastSavedAt(null);

      // Optionally notify backend
      fetch('/api/admin/disputes/draft', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      }).catch((error) => console.warn('Failed to delete draft from database:', error));
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }, [clientId]);

  // Get formatted "last saved" time
  const getLastSavedText = useCallback((): string => {
    if (!lastSavedAt) return 'Never';

    const now = new Date();
    const diffMs = now.getTime() - lastSavedAt.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

    return lastSavedAt.toLocaleString();
  }, [lastSavedAt]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, []);

  return {
    draftLoaded,
    draftExists,
    loadDraft,
    saveDraft,
    setupAutoSave,
    clearDraft,
    lastSavedAt,
    getLastSavedText,
  };
}

/**
 * Helper function to recover wizard state from draft
 * Returns the saved state or null if no draft exists
 */
export async function recoverWizardDraft(clientId?: string): Promise<WizardDraftData | null> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const draft = JSON.parse(stored) as WizardDraftData;

    // Validate draft is for correct client if specified
    if (clientId && draft.selectedClientId !== clientId) {
      return null;
    }

    return draft;
  } catch (error) {
    console.error('Failed to recover draft:', error);
    return null;
  }
}

/**
 * Helper function to get draft metadata
 */
export function getDraftMetadata(): DraftMetadata | null {
  try {
    const stored = localStorage.getItem(METADATA_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as DraftMetadata;
  } catch (error) {
    console.error('Failed to get draft metadata:', error);
    return null;
  }
}

/**
 * Helper function to check if a draft exists and is valid
 */
export function hasDraft(clientId?: string): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    const draft = JSON.parse(stored) as WizardDraftData;

    // Check if draft is for the same client
    if (clientId && draft.selectedClientId !== clientId) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

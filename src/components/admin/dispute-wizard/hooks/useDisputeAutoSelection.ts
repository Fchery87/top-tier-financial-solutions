import * as React from 'react';
import { toast } from 'sonner';
import type { AIAnalysisResult, AIAnalysisSummary, GenerationMethod, ItemDisputeInstruction } from '../types';

interface AutoSelectSummaryResponse {
  itemCount?: number;
  recommendedMethodology?: string;
  recommendedReasonCodes?: string[];
  allReasonCodes?: string[];
  allMetro2Violations?: string[];
  allFcraIssues?: string[];
  averageConfidence?: number;
}

interface AutoSelectResponse {
  recommended_item_ids?: string[];
  analyses?: AIAnalysisResult[];
  summary?: AutoSelectSummaryResponse;
}

interface UseDisputeAutoSelectionOptions {
  getClientId: () => string | null | undefined;
  getDisputeRound: () => number;
  getGenerationMethod: () => GenerationMethod;
  getNegativeItemCount: () => number;
  setSelectedItems: React.Dispatch<React.SetStateAction<string[]>>;
  setItemDisputeInstructions: React.Dispatch<React.SetStateAction<Map<string, ItemDisputeInstruction>>>;
  setSelectedMethodology: React.Dispatch<React.SetStateAction<string>>;
  setRecommendedMethodology: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedReasonCodes: React.Dispatch<React.SetStateAction<string[]>>;
  setAiAnalysisResults: React.Dispatch<React.SetStateAction<AIAnalysisResult[]>>;
  setAiAnalysisSummary: React.Dispatch<React.SetStateAction<AIAnalysisSummary | null>>;
}

export function useDisputeAutoSelection({
  getClientId,
  getDisputeRound,
  getGenerationMethod,
  getNegativeItemCount,
  setSelectedItems,
  setItemDisputeInstructions,
  setSelectedMethodology,
  setRecommendedMethodology,
  setSelectedReasonCodes,
  setAiAnalysisResults,
  setAiAnalysisSummary,
}: UseDisputeAutoSelectionOptions) {
  const [autoSelecting, setAutoSelecting] = React.useState(false);
  const [autoSelectSummary, setAutoSelectSummary] = React.useState('');

  const autoSelectDisputableItems = React.useCallback(async () => {
    const clientId = getClientId();
    if (!clientId) return;

    setAutoSelecting(true);
    setAutoSelectSummary('');
    try {
      const response = await fetch('/api/admin/disputes/auto-select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, round: getDisputeRound() }),
      });
      if (!response.ok) {
        toast.error('Failed to auto-select disputable items');
        return;
      }

      const data = await response.json() as AutoSelectResponse;
      const recommendedIds = data.recommended_item_ids || [];
      setSelectedItems(recommendedIds);

      if (getGenerationMethod() === 'template') {
        setItemDisputeInstructions(prev => {
          const newMap = new Map(prev);
          recommendedIds.forEach(id => {
            if (!newMap.has(id)) newMap.set(id, { itemId: id, instructionType: 'preset', presetCode: '' });
          });
          return newMap;
        });
      }

      if (data.summary?.recommendedMethodology) {
        setSelectedMethodology(data.summary.recommendedMethodology);
        setRecommendedMethodology(data.summary.recommendedMethodology);
      }
      if (data.summary?.recommendedReasonCodes) setSelectedReasonCodes(data.summary.recommendedReasonCodes);

      setAiAnalysisResults(data.analyses || []);
      setAiAnalysisSummary(data.summary ? {
        itemCount: data.summary.itemCount ?? recommendedIds.length,
        recommendedMethodology: data.summary.recommendedMethodology || 'factual',
        allReasonCodes: data.summary.allReasonCodes ?? [],
        recommendedReasonCodes: data.summary.recommendedReasonCodes ?? [],
        averageConfidence: data.summary.averageConfidence ?? 0,
        allMetro2Violations: data.summary.allMetro2Violations ?? [],
        allFcraIssues: data.summary.allFcraIssues ?? [],
        analysisNotes: '',
      } : null);
      setAutoSelectSummary(`Selected ${recommendedIds.length} of ${data.summary?.itemCount ?? getNegativeItemCount()} disputable items (avg confidence ${data.summary?.averageConfidence ?? 0})`);
    } catch (error) {
      console.error('Error auto-selecting items:', error);
      toast.error('Error auto-selecting disputable items');
    } finally {
      setAutoSelecting(false);
    }
  }, [getClientId, getDisputeRound, getGenerationMethod, getNegativeItemCount, setAiAnalysisResults, setAiAnalysisSummary, setItemDisputeInstructions, setRecommendedMethodology, setSelectedItems, setSelectedMethodology, setSelectedReasonCodes]);

  return {
    autoSelecting,
    setAutoSelecting,
    autoSelectSummary,
    setAutoSelectSummary,
    autoSelectDisputableItems,
  };
}

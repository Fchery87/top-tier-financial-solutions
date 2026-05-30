import * as React from 'react';
import type { AIAnalysisResult, AIAnalysisSummary, AnalysisAggressiveness } from '../types';

interface UseAIAnalysisOptions {
  getSelectedItems: () => string[];
  getDisputeRound: () => number;
  onRecommendedMethodology: (methodology: string) => void;
  onOperationError: (message: string) => void;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  onRetry?: (attempt: number, error: Error) => void,
): Promise<T | null> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Attempt ${attempt} failed:`, lastError.message);
      onRetry?.(attempt, lastError);
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 500;
        console.log(`Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  console.error('All retry attempts failed:', lastError?.message);
  return null;
}

export function useAIAnalysis({
  getSelectedItems,
  getDisputeRound,
  onRecommendedMethodology,
  onOperationError,
}: UseAIAnalysisOptions) {
  const [aiAnalysisResults, setAiAnalysisResults] = React.useState<AIAnalysisResult[]>([]);
  const [aiAnalysisSummary, setAiAnalysisSummary] = React.useState<AIAnalysisSummary | null>(null);
  const [analyzingItems, setAnalyzingItems] = React.useState(false);
  const [analysisProgress, setAnalysisProgress] = React.useState(0);
  const [analysisTotalItems, setAnalysisTotalItems] = React.useState(0);
  const [_analysisStartTime, setAnalysisStartTime] = React.useState<number | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = React.useState<number | null>(null);
  const [failedAnalysisItems, setFailedAnalysisItems] = React.useState<Set<string>>(new Set());
  const [analysisRetryCount, setAnalysisRetryCount] = React.useState(0);
  const [_showRetryButton, setShowRetryButton] = React.useState(false);
  const [analysisAggressiveness, setAnalysisAggressiveness] = React.useState<AnalysisAggressiveness>('balanced');
  const [analysisPreferencesSaved, setAnalysisPreferencesSaved] = React.useState(false);

  const analysisStartTimeRef = React.useRef<number | null>(null);
  const aiAnalysisResultsRef = React.useRef<AIAnalysisResult[]>([]);
  const aiAnalysisSummaryRef = React.useRef<AIAnalysisSummary | null>(null);
  const failedAnalysisItemsRef = React.useRef<Set<string>>(new Set());
  const analysisRetryCountRef = React.useRef(0);

  React.useEffect(() => { aiAnalysisResultsRef.current = aiAnalysisResults; }, [aiAnalysisResults]);
  React.useEffect(() => { aiAnalysisSummaryRef.current = aiAnalysisSummary; }, [aiAnalysisSummary]);
  React.useEffect(() => { failedAnalysisItemsRef.current = failedAnalysisItems; }, [failedAnalysisItems]);
  React.useEffect(() => { analysisRetryCountRef.current = analysisRetryCount; }, [analysisRetryCount]);

  React.useEffect(() => {
    const savedPreferences = localStorage.getItem('dispute-analysis-preferences');
    if (!savedPreferences) return;

    try {
      const prefs = JSON.parse(savedPreferences) as { aggressiveness?: AnalysisAggressiveness };
      if (prefs.aggressiveness) setAnalysisAggressiveness(prefs.aggressiveness);
    } catch (error) {
      console.error('Failed to load analysis preferences:', error);
    }
  }, []);

  const saveAnalysisPreferences = React.useCallback(async () => {
    try {
      const preferences = { aggressiveness: analysisAggressiveness, savedAt: new Date().toISOString() };
      localStorage.setItem('dispute-analysis-preferences', JSON.stringify(preferences));
      setAnalysisPreferencesSaved(true);
      setTimeout(() => setAnalysisPreferencesSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save analysis preferences:', error);
    }
  }, [analysisAggressiveness]);

  const analyzeItemsWithAI = React.useCallback(async (retryFailedOnly: boolean = false): Promise<{ analyses: AIAnalysisResult[]; summary: AIAnalysisSummary } | null> => {
    const itemsToAnalyze = retryFailedOnly ? Array.from(failedAnalysisItemsRef.current) : getSelectedItems();
    if (itemsToAnalyze.length === 0) return null;

    setAnalyzingItems(true);
    setAnalysisTotalItems(itemsToAnalyze.length);
    setAnalysisProgress(0);
    analysisStartTimeRef.current = Date.now();
    setAnalysisStartTime(Date.now());
    setEstimatedTimeRemaining(null);
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
            body: JSON.stringify({ itemIds: itemsToAnalyze, round: getDisputeRound(), aggressiveness: analysisAggressiveness }),
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
          return response.json();
        },
        3,
        (attempt) => console.log(`Analysis retry attempt ${attempt}/3...`),
      );

      clearInterval(progressInterval);

      if (!data) throw new Error('Analysis failed after 3 retry attempts');

      const analyses: AIAnalysisResult[] = data.analyses || [];
      const summary = data.summary as AIAnalysisSummary | null;
      if (!summary) throw new Error('Analysis response missing summary');

      if (retryFailedOnly) {
        setFailedAnalysisItems(new Set());
        setAnalysisRetryCount(0);
      }

      if (retryFailedOnly && aiAnalysisResultsRef.current.length > 0) {
        const mergedAnalyses = aiAnalysisResultsRef.current.map(existing => {
          const updated = analyses.find((analysis) => analysis.itemId === existing.itemId);
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
      if (summary?.recommendedMethodology) onRecommendedMethodology(summary.recommendedMethodology);

      return retryFailedOnly && aiAnalysisSummaryRef.current
        ? { analyses: aiAnalysisResultsRef.current, summary: aiAnalysisSummaryRef.current }
        : { analyses, summary };
    } catch (error) {
      clearInterval(progressInterval);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error analyzing items:', errorMessage);

      const failedSet = new Set(failedAnalysisItemsRef.current);
      itemsToAnalyze.forEach(id => failedSet.add(id));
      setFailedAnalysisItems(failedSet);
      setAnalysisRetryCount(prev => prev + 1);
      setShowRetryButton(true);

      let userMessage = 'Failed to analyze ';
      userMessage += retryFailedOnly ? `${failedSet.size} item(s) after ${analysisRetryCountRef.current + 1} retry attempt(s). ` : 'items. ';
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) userMessage += 'Please check your internet connection and try again.';
      else if (errorMessage.includes('408') || errorMessage.includes('504') || errorMessage.includes('timeout')) userMessage += 'Request timed out. Try with fewer items or retry failed items.';
      else userMessage += 'Please try again or contact support if the problem persists.';

      onOperationError(userMessage);
      return null;
    } finally {
      setAnalyzingItems(false);
      setAnalysisProgress(0);
      setAnalysisTotalItems(0);
      setAnalysisStartTime(null);
      analysisStartTimeRef.current = null;
      clearInterval(progressInterval);
    }
  }, [analysisAggressiveness, getDisputeRound, getSelectedItems, onOperationError, onRecommendedMethodology]);

  return {
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
  };
}

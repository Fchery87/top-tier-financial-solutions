import * as React from 'react';
import type { TriageQuickAction } from '../types';

export interface TriageSummaryResponse {
  quickActions: TriageQuickAction[];
  historicalRecommendations?: Record<string, string>;
}

export interface DiscrepancySummary {
  total: number;
  highSeverity: number;
}

interface UseDisputeIntelligenceOptions {
  getDisputeRound: () => number;
}

function buildDiscrepanciesUrl(clientId: string, reportId?: string | null): string {
  const searchParams = new URLSearchParams({ clientId });
  if (reportId) {
    searchParams.set('reportId', reportId);
  }
  return `/api/admin/disputes/discrepancies?${searchParams.toString()}`;
}

export function useDisputeIntelligence({ getDisputeRound }: UseDisputeIntelligenceOptions) {
  const [discrepancySummary, setDiscrepancySummary] = React.useState<DiscrepancySummary | null>(null);
  const [loadingDiscrepancies, setLoadingDiscrepancies] = React.useState(false);
  const [triageQuickActions, setTriageQuickActions] = React.useState<TriageQuickAction[]>([]);
  const [historicalRecommendations, setHistoricalRecommendations] = React.useState<Record<string, string>>({});
  const [_loadingTriage, setLoadingTriage] = React.useState(false);

  const fetchDiscrepancies = React.useCallback(async (clientId: string, reportId?: string | null) => {
    setLoadingDiscrepancies(true);
    try {
      const response = await fetch(buildDiscrepanciesUrl(clientId, reportId));
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
  }, []);

  const fetchTriage = React.useCallback(async (clientId: string) => {
    setLoadingTriage(true);
    try {
      const response = await fetch('/api/admin/disputes/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, round: getDisputeRound() }),
      });
      if (response.ok) {
        const data = await response.json() as TriageSummaryResponse;
        setTriageQuickActions(data.quickActions || []);
        setHistoricalRecommendations(data.historicalRecommendations || {});
      }
    } catch (error) {
      console.error('Error fetching triage:', error);
    } finally {
      setLoadingTriage(false);
    }
  }, [getDisputeRound]);

  return {
    discrepancySummary,
    setDiscrepancySummary,
    loadingDiscrepancies,
    setLoadingDiscrepancies,
    triageQuickActions,
    setTriageQuickActions,
    historicalRecommendations,
    setHistoricalRecommendations,
    fetchDiscrepancies,
    fetchTriage,
  };
}

export { buildDiscrepanciesUrl };

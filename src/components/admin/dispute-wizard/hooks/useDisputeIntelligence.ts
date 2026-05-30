import * as React from 'react';
import type { TriageQuickAction } from '../types';

interface DiscrepancySummary {
  total: number;
  highSeverity: number;
}

interface UseDisputeIntelligenceOptions {
  getDisputeRound: () => number;
}

export function useDisputeIntelligence({ getDisputeRound }: UseDisputeIntelligenceOptions) {
  const [discrepancySummary, setDiscrepancySummary] = React.useState<DiscrepancySummary | null>(null);
  const [loadingDiscrepancies, setLoadingDiscrepancies] = React.useState(false);
  const [triageQuickActions, setTriageQuickActions] = React.useState<TriageQuickAction[]>([]);
  const [_loadingTriage, setLoadingTriage] = React.useState(false);

  const fetchDiscrepancies = React.useCallback(async (clientId: string) => {
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
        const data = await response.json();
        setTriageQuickActions(data.quickActions || []);
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
    fetchDiscrepancies,
    fetchTriage,
  };
}

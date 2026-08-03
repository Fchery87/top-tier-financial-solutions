import * as React from 'react';

interface UseSelectedClientDataLoadOptions {
  selectedClientId?: string;
  selectedReportId?: string | null;
  fetchNegativeItems: (clientId: string) => Promise<void>;
  fetchDiscrepancies: (clientId: string, reportId?: string | null) => Promise<void>;
  fetchTriage: (clientId: string) => Promise<void>;
  fetchEvidence: (clientId: string) => Promise<void>;
}

export function useSelectedClientDataLoad({
  selectedClientId,
  selectedReportId,
  fetchNegativeItems,
  fetchDiscrepancies,
  fetchTriage,
  fetchEvidence,
}: UseSelectedClientDataLoadOptions) {
  React.useEffect(() => {
    if (!selectedClientId) return;

    void fetchNegativeItems(selectedClientId);
    void fetchTriage(selectedClientId);
    void fetchEvidence(selectedClientId);
  }, [
    selectedClientId,
    fetchNegativeItems,
    fetchTriage,
    fetchEvidence,
  ]);

  React.useEffect(() => {
    if (!selectedClientId) return;
    void fetchDiscrepancies(selectedClientId, selectedReportId);
  }, [selectedClientId, selectedReportId, fetchDiscrepancies]);
}

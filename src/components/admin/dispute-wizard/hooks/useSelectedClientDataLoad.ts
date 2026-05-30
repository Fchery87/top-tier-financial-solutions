import * as React from 'react';

interface UseSelectedClientDataLoadOptions {
  selectedClientId?: string;
  fetchNegativeItems: (clientId: string) => Promise<void>;
  fetchDiscrepancies: (clientId: string) => Promise<void>;
  fetchTriage: (clientId: string) => Promise<void>;
  fetchEvidence: (clientId: string) => Promise<void>;
}

export function useSelectedClientDataLoad({
  selectedClientId,
  fetchNegativeItems,
  fetchDiscrepancies,
  fetchTriage,
  fetchEvidence,
}: UseSelectedClientDataLoadOptions) {
  React.useEffect(() => {
    if (!selectedClientId) return;

    void fetchNegativeItems(selectedClientId);
    void fetchDiscrepancies(selectedClientId);
    void fetchTriage(selectedClientId);
    void fetchEvidence(selectedClientId);
  }, [
    selectedClientId,
    fetchNegativeItems,
    fetchDiscrepancies,
    fetchTriage,
    fetchEvidence,
  ]);
}

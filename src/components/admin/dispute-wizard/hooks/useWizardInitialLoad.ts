import * as React from 'react';

interface UseWizardInitialLoadOptions {
  fetchClients: () => void | Promise<void>;
  fetchReasonCodes: () => void | Promise<void>;
  fetchMethodologies: () => void | Promise<void>;
}

export function useWizardInitialLoad({
  fetchClients,
  fetchReasonCodes,
  fetchMethodologies,
}: UseWizardInitialLoadOptions) {
  React.useEffect(() => {
    void fetchClients();
    void fetchReasonCodes();
    void fetchMethodologies();
  }, [fetchClients, fetchReasonCodes, fetchMethodologies]);
}

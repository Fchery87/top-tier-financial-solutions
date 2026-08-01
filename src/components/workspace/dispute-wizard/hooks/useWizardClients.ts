import * as React from 'react';
import type { Client } from '../types';

export function useWizardClients() {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [clientSearch, setClientSearch] = React.useState('');
  const [loadingClients, setLoadingClients] = React.useState(false);

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

  return {
    clients,
    setClients,
    selectedClient,
    setSelectedClient,
    clientSearch,
    setClientSearch,
    loadingClients,
    setLoadingClients,
    fetchClients,
  };
}

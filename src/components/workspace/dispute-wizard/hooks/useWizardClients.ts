import * as React from 'react';
import type { Client } from '../types';

export function useWizardClients() {
  const [clients, setClients] = React.useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = React.useState<Client | null>(null);
  const [clientSearch, setClientSearch] = React.useState('');
  const [loadingClients, setLoadingClients] = React.useState(false);
  const [clientsError, setClientsError] = React.useState<string | null>(null);

  const fetchClients = React.useCallback(async () => {
    setLoadingClients(true);
    setClientsError(null);
    try {
      const searchParam = clientSearch ? `&search=${encodeURIComponent(clientSearch)}` : '';
      const response = await fetch(`/api/admin/clients?page=1&limit=50&status=active${searchParam}`);
      if (!response.ok) throw new Error(`Client request failed with status ${response.status}`);
      const data = await response.json();
      setClients(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      console.error('Error fetching clients:', error);
      setClientsError('Error loading clients. Please retry.');
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
    clientsError,
    setClientsError,
    fetchClients,
  };
}

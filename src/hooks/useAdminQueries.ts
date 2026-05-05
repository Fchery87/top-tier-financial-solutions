import { useQuery } from '@tanstack/react-query';

export function useDashboardStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    staleTime: 60 * 1000,
  });
}

export function useClients(params?: Record<string, string>) {
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  return useQuery({
    queryKey: ['admin', 'clients', params],
    queryFn: async () => {
      const response = await fetch(`/api/admin/clients${queryString}`);
      if (!response.ok) throw new Error('Failed to fetch clients');
      return response.json();
    },
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ['admin', 'clients', id],
    queryFn: async () => {
      const response = await fetch(`/api/admin/clients/${id}`);
      if (!response.ok) throw new Error('Failed to fetch client');
      return response.json();
    },
    enabled: !!id,
  });
}

export function useClientDisputes(clientId: string) {
  return useQuery({
    queryKey: ['admin', 'clients', clientId, 'disputes'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/disputes?clientId=${clientId}`);
      if (!response.ok) throw new Error('Failed to fetch disputes');
      return response.json();
    },
    enabled: !!clientId,
  });
}

export function useTasks(params?: Record<string, string>) {
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  return useQuery({
    queryKey: ['admin', 'tasks', params],
    queryFn: async () => {
      const response = await fetch(`/api/admin/tasks${queryString}`);
      if (!response.ok) throw new Error('Failed to fetch tasks');
      return response.json();
    },
  });
}

export function useDisputes(params?: Record<string, string>) {
  const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
  return useQuery({
    queryKey: ['admin', 'disputes', params],
    queryFn: async () => {
      const response = await fetch(`/api/admin/disputes${queryString}`);
      if (!response.ok) throw new Error('Failed to fetch disputes');
      return response.json();
    },
  });
}

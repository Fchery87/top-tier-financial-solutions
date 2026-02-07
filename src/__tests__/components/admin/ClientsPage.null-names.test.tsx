import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import ClientsPage from '@/app/admin/clients/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: vi.fn(() => null) }),
}));

describe('ClientsPage null name safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/admin/clients')) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: 'client-1',
                user_id: null,
                lead_id: null,
                first_name: null,
                last_name: null,
                email: 'null-name-client@example.com',
                phone: null,
                status: 'active',
                notes: null,
                converted_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                user_name: null,
              },
            ],
          }),
        } as Response;
      }

      if (url.includes('/api/admin/leads')) {
        return {
          ok: true,
          json: async () => ({ items: [] }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    }) as typeof fetch;
  });

  it('renders client row when first/last names are null', async () => {
    render(<ClientsPage />);

    await waitFor(() => {
      expect(screen.getByText('null-name-client@example.com')).toBeInTheDocument();
    });
  });
});

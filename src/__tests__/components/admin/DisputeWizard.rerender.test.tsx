import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DisputeWizardPage from '@/app/admin/disputes/wizard/page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/hooks/useWizardDraft', () => ({
  useWizardDraft: () => ({
    setupAutoSave: vi.fn(),
    clearDraft: vi.fn(),
    loadDraft: vi.fn(() => null),
  }),
  hasDraft: vi.fn(() => false),
  getDraftMetadata: vi.fn(() => null),
}));

describe('DisputeWizardPage render stability', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/admin/clients')) {
        return {
          ok: true,
          json: async () => ({ items: [] }),
        } as Response;
      }

      if (url.includes('/api/admin/disputes/methodologies')) {
        return {
          ok: true,
          json: async () => ({ methodologies: [], reason_codes: [] }),
        } as Response;
      }

      if (url.includes('/api/admin/disputes/generate-letter')) {
        return {
          ok: true,
          json: async () => ({ reason_codes: [], dispute_types: [] }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    }) as typeof fetch;
  });

  it('renders without entering an infinite re-render loop', async () => {
    render(<DisputeWizardPage />);

    await waitFor(() => {
      expect(screen.getByText('Dispute Wizard')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  it('renders client list when client first/last names are null', async () => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes('/api/admin/clients')) {
        return {
          ok: true,
          json: async () => ({
            items: [
              {
                id: 'client-null-name',
                first_name: null,
                last_name: null,
                email: 'null-name@example.com',
                phone: null,
                status: 'active',
              },
            ],
          }),
        } as Response;
      }

      if (url.includes('/api/admin/disputes/methodologies')) {
        return {
          ok: true,
          json: async () => ({ methodologies: [], reason_codes: [] }),
        } as Response;
      }

      if (url.includes('/api/admin/disputes/generate-letter')) {
        return {
          ok: true,
          json: async () => ({ reason_codes: [], dispute_types: [] }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    }) as typeof fetch;

    render(<DisputeWizardPage />);

    await waitFor(() => {
      expect(screen.getByText('null-name@example.com')).toBeInTheDocument();
    });
  });
});

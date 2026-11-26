import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DisputeWizardPage from '@/app/workspace/disputes/wizard/page';

/**
 * Component tests for the Dispute Wizard page (steps 1 and 2 plus navigation).
 *
 * The wizard talks to these endpoints, which are stubbed by URL below:
 *  - GET /api/workspace/clients?...            -> { items: Client[] }
 *  - GET /api/workspace/clients/:id            -> { negative_items, personal_info_disputes, inquiry_disputes, credit_reports }
 * Everything else the wizard fetches on load (reason codes, methodologies,
 * triage, discrepancies, evidence) gets an empty `{}` response.
 *
 * Steps 3 and 4 are covered by StepConfigure, StepReview and
 * WizardGenerateControls tests in src/components/workspace/dispute-wizard/__tests__.
 */

const mockClients = [
  { id: 'client-1', first_name: 'John', last_name: 'Doe', email: 'john.doe@example.com', status: 'active' },
  { id: 'client-2', first_name: 'Jane', last_name: 'Smith', email: 'jane.smith@example.com', status: 'active' },
];

const mockNegativeItems = [
  {
    id: 'item-1',
    creditor_name: 'Capital One',
    item_type: 'delinquency',
    amount: 500000, // amounts are stored in cents; the UI formats them as dollars
    risk_severity: 'high',
    on_transunion: true,
    on_experian: false,
    on_equifax: false,
  },
  {
    id: 'item-2',
    creditor_name: 'Chase',
    item_type: 'collection',
    amount: 150000,
    risk_severity: 'medium',
    on_transunion: false,
    on_experian: true,
    on_equifax: true,
  },
];

const mockClientDetail = {
  negative_items: mockNegativeItems,
  personal_info_disputes: [{ id: 'pi-1', bureau: 'transunion', type: 'address', value: '123 Main St' }],
  inquiry_disputes: [],
  credit_reports: [],
};

type Responder = (url: string) => { ok: boolean; status?: number; body: unknown };

const fetchMock = vi.fn();

function jsonResponse({ ok, status = ok ? 200 : 500, body }: ReturnType<Responder>) {
  return Promise.resolve({ ok, status, json: async () => body });
}

function stubApi(overrides: Responder = () => ({ ok: true, body: {} })) {
  fetchMock.mockImplementation((input: string) => {
    const url = String(input);
    if (/\/api\/workspace\/clients\/[^/?]+$/.test(url)) return jsonResponse({ ok: true, body: mockClientDetail });
    if (url.startsWith('/api/workspace/clients?')) return jsonResponse({ ok: true, body: { items: mockClients } });
    return jsonResponse(overrides(url));
  });
}

function clientRequests() {
  return fetchMock.mock.calls.map(([url]) => String(url)).filter((url) => url.startsWith('/api/workspace/clients?'));
}

async function selectClientAndContinue(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByTestId('wizard-client-client-1'));
  await user.click(screen.getByRole('button', { name: /next/i }));
  await screen.findByText(/Select Dispute Items/i);
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  window.localStorage.clear();
  stubApi();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DisputeWizard - Component Rendering', () => {
  it('starts on step 1 (Select Client)', async () => {
    render(<DisputeWizardPage />);

    expect(await screen.findByText('Select Client')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Dispute Wizard/i })).toBeInTheDocument();
  });

  it('shows all 4 wizard steps in the progress bar', async () => {
    render(<DisputeWizardPage />);
    await screen.findByText('Select Client');

    for (const name of ['Client', 'Items', 'Configure', 'Review']) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0);
    }
  });

  it('loads active clients from the API on mount', async () => {
    render(<DisputeWizardPage />);

    await waitFor(() => {
      expect(clientRequests()).toContain('/api/workspace/clients?page=1&limit=50&status=active');
    });
  });

  it('shows a loading indicator and no client rows while clients load', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    render(<DisputeWizardPage />);

    expect(await screen.findByText('Select Client')).toBeInTheDocument();
    expect(screen.queryByTestId('wizard-client-client-1')).not.toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });
});

describe('DisputeWizard - Step 1: Client Selection', () => {
  it('renders each client with name and email', async () => {
    render(<DisputeWizardPage />);

    const row = await screen.findByTestId('wizard-client-client-1');
    expect(row).toHaveTextContent('John Doe');
    expect(row).toHaveTextContent('john.doe@example.com');
    expect(screen.getByTestId('wizard-client-client-2')).toHaveTextContent('Jane Smith');
  });

  it('searches clients server-side by passing the term to the API', async () => {
    const user = userEvent.setup();
    render(<DisputeWizardPage />);
    await screen.findByTestId('wizard-client-client-1');

    await user.type(screen.getByPlaceholderText(/search clients/i), 'jane');

    await waitFor(() => {
      expect(clientRequests().some((url) => url.includes('&search=jane'))).toBe(true);
    });
  });

  it('disables Next until a client is selected, then enables it', async () => {
    const user = userEvent.setup();
    render(<DisputeWizardPage />);
    await screen.findByTestId('wizard-client-client-1');

    const next = screen.getByRole('button', { name: /next/i });
    expect(next).toBeDisabled();

    await user.click(screen.getByTestId('wizard-client-client-1'));

    await waitFor(() => expect(next).toBeEnabled());
    expect(screen.queryByText('(Required)')).not.toBeInTheDocument();
  });

  it('proceeds to step 2 and loads the selected client\'s items', async () => {
    const user = userEvent.setup();
    render(<DisputeWizardPage />);

    await selectClientAndContinue(user);

    expect(fetchMock).toHaveBeenCalledWith('/api/workspace/clients/client-1');
    expect(await screen.findByTestId('wizard-item-item-1')).toHaveTextContent('Capital One');
  });
});

describe('DisputeWizard - Step 2: Item Selection', () => {
  it('lists tradelines with creditor and amount, and tab counts', async () => {
    const user = userEvent.setup();
    render(<DisputeWizardPage />);
    await selectClientAndContinue(user);

    const first = await screen.findByTestId('wizard-item-item-1');
    expect(first).toHaveTextContent('Capital One');
    expect(first).toHaveTextContent('$5,000.00');
    expect(screen.getByTestId('wizard-item-item-2')).toHaveTextContent('Chase');
    expect(screen.getByRole('button', { name: 'Tradelines (2)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Personal Info (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inquiries (0)' })).toBeInTheDocument();
  });

  it('keeps Next disabled until at least one item is selected', async () => {
    const user = userEvent.setup();
    render(<DisputeWizardPage />);
    await selectClientAndContinue(user);
    await screen.findByTestId('wizard-item-item-1');

    const next = screen.getByRole('button', { name: /next/i });
    expect(next).toBeDisabled();
    expect(screen.getByText('(Select at least one)')).toBeInTheDocument();

    await user.click(within(screen.getByTestId('wizard-item-item-1')).getByText('Capital One'));
    await waitFor(() => expect(next).toBeEnabled());
  });

  it('selects multiple items and shows the selected count', async () => {
    const user = userEvent.setup();
    render(<DisputeWizardPage />);
    await selectClientAndContinue(user);

    await user.click(within(await screen.findByTestId('wizard-item-item-1')).getByText('Capital One'));
    await user.click(within(screen.getByTestId('wizard-item-item-2')).getByText('Chase'));

    expect(screen.getByText('Selected: 2')).toBeInTheDocument();
    expect(screen.getByText('2 of 2 items selected')).toBeInTheDocument();
  });

  it('deselects an item when clicked again', async () => {
    const user = userEvent.setup();
    render(<DisputeWizardPage />);
    await selectClientAndContinue(user);

    const row = within(await screen.findByTestId('wizard-item-item-1'));
    await user.click(row.getByText('Capital One'));
    expect(screen.getByText('Selected: 1')).toBeInTheDocument();
    await user.click(row.getByText('Capital One'));
    expect(screen.getByText('Selected: 0')).toBeInTheDocument();
  });

  it('shows an empty state when the client has no negative items', async () => {
    fetchMock.mockImplementation((input: string) => {
      const url = String(input);
      if (/\/api\/workspace\/clients\/[^/?]+$/.test(url)) {
        return jsonResponse({ ok: true, body: { ...mockClientDetail, negative_items: [] } });
      }
      if (url.startsWith('/api/workspace/clients?')) return jsonResponse({ ok: true, body: { items: mockClients } });
      return jsonResponse({ ok: true, body: {} });
    });
    const user = userEvent.setup();
    render(<DisputeWizardPage />);
    await screen.findByTestId('wizard-client-client-1');
    await user.click(screen.getByTestId('wizard-client-client-1'));
    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(await screen.findByText(/No negative items found for this client/i)).toBeInTheDocument();
  });
});

describe('DisputeWizard - Validation', () => {
  it('blocks progress from step 1 without a client', async () => {
    render(<DisputeWizardPage />);
    await screen.findByTestId('wizard-client-client-1');

    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    expect(screen.getByText('(Required)')).toBeInTheDocument();
  });

  it('stays on step 1 when the disabled Next button is clicked', async () => {
    const user = userEvent.setup();
    render(<DisputeWizardPage />);
    await screen.findByTestId('wizard-client-client-1');

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText('Select Client')).toBeInTheDocument();
    expect(screen.queryByText(/Select Dispute Items/i)).not.toBeInTheDocument();
  });
});

describe('DisputeWizard - Error Handling', () => {
  it('shows an alert with a retry control when the client fetch fails', async () => {
    fetchMock.mockImplementation((input: string) => {
      const url = String(input);
      if (url.startsWith('/api/workspace/clients?')) return jsonResponse({ ok: false, status: 500, body: { error: 'boom' } });
      return jsonResponse({ ok: true, body: {} });
    });
    render(<DisputeWizardPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Error loading clients. Please retry.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.queryByTestId('wizard-client-client-1')).not.toBeInTheDocument();
  });

  it('recovers when Retry succeeds', async () => {
    let failing = true;
    fetchMock.mockImplementation((input: string) => {
      const url = String(input);
      if (url.startsWith('/api/workspace/clients?')) {
        return failing
          ? jsonResponse({ ok: false, status: 500, body: {} })
          : jsonResponse({ ok: true, body: { items: mockClients } });
      }
      return jsonResponse({ ok: true, body: {} });
    });
    const user = userEvent.setup();
    render(<DisputeWizardPage />);
    await screen.findByRole('alert');

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByTestId('wizard-client-client-1')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('DisputeWizard - Navigation', () => {
  it('disables Back on the first step', async () => {
    render(<DisputeWizardPage />);
    await screen.findByText('Select Client');

    expect(screen.getByRole('button', { name: /back(?! to clients)/i })).toBeDisabled();
  });

  it('goes back from step 2 and keeps the selected client', async () => {
    const user = userEvent.setup();
    render(<DisputeWizardPage />);
    await selectClientAndContinue(user);

    await user.click(screen.getByRole('button', { name: /^back(?! to clients)/i }));

    expect(await screen.findByText('Select Client')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
    expect(screen.queryByText('(Required)')).not.toBeInTheDocument();
  });

  it('keeps the selected items after going back and forward again', async () => {
    const user = userEvent.setup();
    render(<DisputeWizardPage />);
    await selectClientAndContinue(user);
    await user.click(within(await screen.findByTestId('wizard-item-item-1')).getByText('Capital One'));

    await user.click(screen.getByRole('button', { name: /^back(?! to clients)/i }));
    await user.click(await screen.findByRole('button', { name: /next/i }));

    await screen.findByText(/Select Dispute Items/i);
    expect(screen.getByText('Selected: 1')).toBeInTheDocument();
  });
});

describe('DisputeWizard - Accessibility', () => {
  it('gives navigation controls accessible names', async () => {
    render(<DisputeWizardPage />);
    await screen.findByText('Select Client');

    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^back(?! to clients)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to clients/i })).toBeInTheDocument();
  });

  it('labels the client search field', async () => {
    render(<DisputeWizardPage />);

    expect(await screen.findByPlaceholderText(/search clients by name or email/i)).toBeInTheDocument();
  });

  it('supports keyboard navigation: Enter advances and Escape goes back', async () => {
    const user = userEvent.setup();
    render(<DisputeWizardPage />);
    await user.click(await screen.findByTestId('wizard-client-client-1'));
    await waitFor(() => expect(screen.getByRole('button', { name: /next/i })).toBeEnabled());

    await user.keyboard('{Enter}');
    expect(await screen.findByText(/Select Dispute Items/i)).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(await screen.findByText('Select Client')).toBeInTheDocument();
  });
});

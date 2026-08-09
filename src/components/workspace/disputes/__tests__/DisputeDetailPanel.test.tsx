import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastError = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, initial: _initial, animate: _animate, exit: _exit, ...props }: React.HTMLAttributes<HTMLDivElement> & { initial?: unknown; animate?: unknown; exit?: unknown }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('sonner', () => ({ toast: { error: toastError, success: toastSuccess } }));
vi.mock('@/components/workspace/disputes/LetterStudio', () => ({ LetterStudio: () => null }));

import { DisputeDetailPanel } from '@/components/workspace/disputes/DisputeDetailPanel';

const dispute = {
  id: 'dispute-1',
  client_id: 'client-1',
  client_name: 'Response Fixture',
  bureau: 'experian',
  dispute_reason: 'Account ownership',
  status: 'sent',
  round: 1,
  letter_content: null,
  response_deadline: '2020-01-01T00:00:00.000Z',
  response_received_at: null,
  outcome: null,
  response_notes: null,
  response_document_url: null,
  response_channel: null,
  score_impact: null,
  creditor_name: 'Fixture Bank',
};

function renderPanel() {
  const onClose = vi.fn();
  const onResponseLogged = vi.fn();
  render(
    <DisputeDetailPanel
      open
      dispute={dispute}
      onClose={onClose}
      onResponseLogged={onResponseLogged}
    />,
  );
  return { onClose, onResponseLogged };
}

function selectOutcome(outcome: string) {
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: outcome } });
}

describe('DisputeDetailPanel response review', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    toastError.mockReset();
    toastSuccess.mockReset();
  });

  it('requires a response document before saving an actual response', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response(JSON.stringify({ documents: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    renderPanel();
    selectOutcome('verified');

    fireEvent.click(screen.getByRole('button', { name: /save response/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('A response date and document are required for this outcome.');
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/workspace/disputes/evidence?clientId=client-1');
  });

  it('loads client evidence and submits the selected response document ID', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        documents: [{
          id: 'doc-1',
          file_name: 'Bureau response.pdf',
          file_type: 'correspondence',
          created_at: '2026-02-01T00:00:00.000Z',
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        dispute: { response_document_id: 'doc-1' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    renderPanel();
    selectOutcome('verified');

    const documentSelect = await screen.findByLabelText('Response document *');
    fireEvent.change(documentSelect, { target: { value: 'doc-1' } });
    fireEvent.click(screen.getByRole('button', { name: /save response/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith('/api/workspace/disputes/dispute-1', expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('"responseDocumentId":"doc-1"'),
      }));
    });
  });

  it('hides fictitious response evidence fields for a no-response review', () => {
    renderPanel();
    selectOutcome('no_response');

    expect(screen.queryByPlaceholderText('https://...')).not.toBeInTheDocument();
    expect(screen.getByText(/only after the recorded response deadline has elapsed/i)).toBeInTheDocument();
  });

  it('opens packet assembly as an explicit staff action for this dispute', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ documents: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ packets: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /build evidence packet/i }));

    expect(await screen.findByText('No evidence packets yet.')).toBeInTheDocument();
  });

  it('keeps the review open and requires a second click to create a recommended draft', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({
        documents: [{
          id: 'doc-1',
          file_name: 'Bureau response.pdf',
          file_type: 'correspondence',
          created_at: '2026-02-01T00:00:00.000Z',
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        next_cycle_recommendation: {
          kind: 'create_next_draft',
          title: 'Create Round 2 draft',
          detail: 'A staff member must explicitly create this draft.',
          plan: { nextRound: 2 },
        },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Draft created' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const { onClose, onResponseLogged } = renderPanel();
    selectOutcome('verified');
    fireEvent.change(await screen.findByLabelText('Response document *'), { target: { value: 'doc-1' } });

    fireEvent.click(screen.getByRole('button', { name: /save response/i }));

    expect(await screen.findByText('Create Round 2 draft')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /create recommended draft/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /create recommended draft/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith('/api/workspace/disputes/dispute-1/quick-redispute', { method: 'POST' });
    });
    expect(onResponseLogged).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows an API error returned while saving a response review', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response(
      JSON.stringify({
        documents: [{
          id: 'doc-1',
          file_name: 'Bureau response.pdf',
          file_type: 'correspondence',
          created_at: '2026-02-01T00:00:00.000Z',
        }],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )).mockResolvedValueOnce(new Response(
      JSON.stringify({ error: 'No response can be recorded only after the response deadline has elapsed' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    ));
    renderPanel();
    selectOutcome('verified');
    fireEvent.change(await screen.findByLabelText('Response document *'), { target: { value: 'doc-1' } });

    fireEvent.click(screen.getByRole('button', { name: /save response/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith('No response can be recorded only after the response deadline has elapsed');
    });
  });
});

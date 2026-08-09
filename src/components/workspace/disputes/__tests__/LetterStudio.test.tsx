import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LetterStudio } from '@/components/workspace/disputes/LetterStudio';

describe('LetterStudio', () => {
  beforeEach(() => {
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/letter')) {
        return new Response(JSON.stringify({
          content: 'Original letter',
          current_revision: 1,
          immutable_reason: null,
          lint: { findings: [], blocked: false },
          library: { name: 'Verification strategy', methodology: 'factual', rationale: { rationale: ['Matches the reason code.'] } },
          revisions: [{ id: 'revision-1', revision: 1, source: 'generated', tone_label: null, warnings_acknowledged: false, created_by: 'admin-1', created_at: '2026-08-02T00:00:00.000Z', content: 'Original letter' }],
        }), { status: 200 });
      }
      if (url.endsWith('/lint')) return new Response(JSON.stringify({ findings: [], blocked: false }), { status: 200 });
      return new Response(JSON.stringify({ revision: 2, content: 'Updated letter', letter: 'Updated letter', findings: [] }), { status: 200 });
    }) as typeof fetch;
  });

  it('loads aggregate state, shows attribution, and saves edits', async () => {
    render(<LetterStudio disputeId="dispute-1" initialLetter="Original letter" />);

    expect(await screen.findByText('Verification strategy')).toBeInTheDocument();
    const textarea = screen.getByRole('textbox', { name: 'Dispute letter content' });
    fireEvent.change(textarea, { target: { value: 'Updated letter' } });
    fireEvent.click(screen.getByRole('button', { name: /save letter/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/workspace/disputes/dispute-1', expect.objectContaining({ method: 'PUT' })));
  });

  it('autosaves dirty edits when focus leaves the studio', async () => {
    render(
      <>
        <LetterStudio disputeId="dispute-1" initialLetter="Original letter" />
        <button type="button">Outside studio</button>
      </>,
    );

    const textarea = await screen.findByRole('textbox', { name: 'Dispute letter content' });
    fireEvent.change(textarea, { target: { value: 'Autosaved letter' } });
    screen.getByRole('button', { name: 'Outside studio' }).focus();
    fireEvent.blur(textarea);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/workspace/disputes/dispute-1',
      expect.objectContaining({ method: 'PUT', body: expect.stringContaining('Autosaved letter') }),
    ));
  });

  it('renders the server immutable banner and disables editing', async () => {
    global.fetch = vi.fn(async () => new Response(JSON.stringify({
      content: 'Sent letter', current_revision: 1, immutable_reason: 'This dispute has been sent and its letter is immutable.', lint: { findings: [] }, revisions: [], library: null,
    }), { status: 200 })) as typeof fetch;
    render(<LetterStudio disputeId="dispute-2" initialLetter="Sent letter" />);

    expect(await screen.findByText(/has been sent and its letter is immutable/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Dispute letter content' })).toBeDisabled();
  });
});

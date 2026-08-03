import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const routerPush = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPush }),
}));

import { CommandPalette } from '@/components/workspace/CommandPalette';

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('keeps static commands for short queries and searches records after two characters', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      query: 'jane',
      results: [
        {
          kind: 'client',
          id: 'client-jane',
          label: 'Jane Doe',
          description: 'jane@example.com · Active',
          href: '/workspace/clients/client-jane',
        },
        {
          kind: 'dispute',
          id: 'dispute-1',
          label: 'Jane Doe — Capital One',
          description: 'Experian · Round 2 · Sent',
          href: '/workspace/disputes?dispute=dispute-1',
        },
      ],
    }), { status: 200 }));

    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

    const input = screen.getByRole('textbox', { name: 'Workspace record search' });
    fireEvent.change(input, { target: { value: 'j' } });
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: 'jane' } });
    expect(await screen.findByRole('link', { name: /Jane Doe, jane@example.com/ })).toBeInTheDocument();
    expect(screen.getByText('Clients')).toBeInTheDocument();
    expect(screen.getByText('Disputes')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/admin/search?q=jane', expect.any(Object));
  });

  it('links to a selected record and closes the palette', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      query: 'jane',
      results: [{
        kind: 'client',
        id: 'client-jane',
        label: 'Jane Doe',
        description: 'jane@example.com · Active',
        href: '/workspace/clients/client-jane',
      }],
    }), { status: 200 }));

    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const input = screen.getByRole('textbox', { name: 'Workspace record search' });
    fireEvent.change(input, { target: { value: 'jane' } });

    const resultLink = await screen.findByRole('link', { name: /Jane Doe, jane@example.com/ });
    fireEvent.click(resultLink);

    expect(resultLink).toHaveAttribute('href', '/workspace/clients/client-jane');
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Workspace record search' })).not.toBeInTheDocument());
  });

  it('shows an actionable error when record search fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network failure'));

    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    fireEvent.change(screen.getByRole('textbox', { name: 'Workspace record search' }), { target: { value: 'jane' } });

    expect(await screen.findByText('Unable to search records.')).toBeInTheDocument();
  });
});

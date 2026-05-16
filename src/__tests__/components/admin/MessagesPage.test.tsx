import { describe, expect, it, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MessagesPage from '@/app/admin/messages/page';

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, { get: (_target, tag) => tag }),
}));

describe('MessagesPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not crash when the threads response omits items', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    render(<MessagesPage />);

    expect(await screen.findByText('No message threads yet. Start a conversation with a client.')).toBeInTheDocument();
  });

  it('does not crash when a selected thread response omits messages', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: 'thread-1',
              client_id: 'client-1',
              subject: 'Question',
              status: 'open',
              last_message_at: '2026-05-06T12:00:00.000Z',
              unread_by_admin: 0,
              created_at: '2026-05-06T12:00:00.000Z',
              client_name: 'Jane Client',
              client_email: 'jane@example.com',
            },
          ],
          total_unread: 0,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [], total_unread: 0 }),
      } as Response);

    render(<MessagesPage />);

    fireEvent.click(await screen.findByText('Jane Client'));

    expect(await screen.findByText('Question')).toBeInTheDocument();
  });
});

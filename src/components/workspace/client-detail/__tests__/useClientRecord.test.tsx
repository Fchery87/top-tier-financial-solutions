import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClientRecord } from '../hooks/useClientRecord';

const clientPayload = {
  client: {
    id: 'client-1',
    user_id: null,
    lead_id: null,
    first_name: 'Ada',
    last_name: 'Lovelace',
    email: 'ada@example.com',
    phone: null,
    status: 'active',
    notes: null,
    converted_at: null,
    created_at: '2026-08-09T00:00:00.000Z',
    user_name: null,
  },
  readiness: {
    has_portal_user: true,
    has_signed_agreement: true,
    has_credit_report: true,
    has_analyzed_report: true,
    has_case: true,
    has_disputes: false,
    unfinished_client_tasks: 1,
    blocking_tasks: 0,
    is_ready_for_round: true,
  },
  credit_reports: [],
  latest_analysis: null,
  credit_accounts: [],
  negative_items: [],
  negative_items_count: 0,
  disputes: [],
  score_history: [],
};

function jsonResponse(payload: unknown, ok = true): Response {
  return new Response(JSON.stringify(payload), {
    status: ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useClientRecord', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads one coherent client record and refreshes it after a mutation', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(clientPayload))
      .mockResolvedValueOnce(jsonResponse({ items: [{
        id: 'note-1', client_id: 'client-1', author_id: null, author_name: null,
        content: 'Ready for review', created_at: '2026-08-09T00:00:00.000Z',
      }] }))
      .mockResolvedValueOnce(jsonResponse({ items: [{
        id: 'task-1', client_id: 'client-1', title: 'Upload ID', description: null,
        status: 'todo', priority: 'high', due_date: null, created_at: '2026-08-09T00:00:00.000Z',
      }] }))
      .mockResolvedValueOnce(jsonResponse({
        ...clientPayload,
        client: { ...clientPayload.client, status: 'paused' },
      }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }));

    const { result } = renderHook(() => useClientRecord('client-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.client?.first_name).toBe('Ada');
    expect(result.current.readiness?.is_ready_for_round).toBe(true);
    expect(result.current.clientNotes).toHaveLength(1);
    expect(result.current.clientTasks).toHaveLength(1);

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.client?.status).toBe('paused');
    expect(result.current.clientNotes).toEqual([]);
    expect(result.current.clientTasks).toEqual([]);
  });

  it('keeps the primary snapshot when notes or tasks are temporarily unavailable', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(clientPayload))
      .mockResolvedValueOnce(jsonResponse({ error: 'notes unavailable' }, false))
      .mockResolvedValueOnce(jsonResponse({ error: 'tasks unavailable' }, false));

    const { result } = renderHook(() => useClientRecord('client-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.client?.id).toBe('client-1');
    expect(result.current.clientNotes).toEqual([]);
    expect(result.current.clientTasks).toEqual([]);
  });

  it('keeps the primary snapshot when a secondary request fails at the network boundary', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(clientPayload))
      .mockRejectedValueOnce(new Error('notes network failure'))
      .mockResolvedValueOnce(jsonResponse({ items: [] }));

    const { result } = renderHook(() => useClientRecord('client-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.client?.id).toBe('client-1');
    expect(result.current.clientNotes).toEqual([]);
    expect(result.current.clientTasks).toEqual([]);
  });

  it('surfaces a primary snapshot failure and lets the user retry', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'unavailable' }, false))
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse(clientPayload))
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }));

    const { result } = renderHook(() => useClientRecord('client-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Failed to load client record');

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.client?.id).toBe('client-1');
  });

  it('marks a missing client so presentation can return to the client list', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }));

    const { result } = renderHook(() => useClientRecord('missing-client'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.notFound).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('aborts an in-flight request when the selected client changes', async () => {
    const fetchMock = vi.mocked(fetch);
    let firstRequestSignal: AbortSignal | undefined;
    fetchMock.mockImplementation((_, init) => {
      firstRequestSignal ??= init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });

    const { rerender } = renderHook(({ clientId }) => useClientRecord(clientId), {
      initialProps: { clientId: 'client-1' },
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    rerender({ clientId: 'client-2' });

    expect(firstRequestSignal?.aborted).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import {
  normalizeWorkspaceSearchQuery,
  searchWorkspaceRecords,
} from '@/lib/workspace-search';

const clients = [
  {
    id: 'client-jane',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    status: 'active',
  },
  {
    id: 'client-janet',
    firstName: 'Janet',
    lastName: 'Smith',
    email: 'janet@example.com',
    status: 'pending',
  },
];

const disputes = [
  {
    id: 'dispute-1',
    clientName: 'Jane Doe',
    creditorName: 'Capital One',
    disputeReason: 'Incorrect balance',
    bureau: 'experian',
    status: 'sent',
    round: 2,
  },
  {
    id: 'dispute-2',
    clientName: 'Janet Smith',
    creditorName: null,
    disputeReason: 'Account is not mine',
    bureau: 'equifax',
    status: 'draft',
    round: 1,
  },
];

describe('workspace search', () => {
  it('normalizes whitespace and requires at least two characters', () => {
    expect(normalizeWorkspaceSearchQuery('  JaNe  ')).toBe('jane');
    expect(normalizeWorkspaceSearchQuery(' j ')).toBeNull();
    expect(normalizeWorkspaceSearchQuery('   ')).toBeNull();
  });

  it('matches clients and disputes through their authorized display fields', () => {
    const results = searchWorkspaceRecords({ query: 'jane doe', clients, disputes });

    expect(results).toEqual([
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
    ]);
  });

  it('ranks exact identifiers before prefix and substring matches', () => {
    const results = searchWorkspaceRecords({ query: 'dispute-2', clients, disputes });

    expect(results[0]).toMatchObject({ kind: 'dispute', id: 'dispute-2' });
  });

  it('limits each result category independently', () => {
    const repeatedClients = Array.from({ length: 8 }, (_, index) => ({
      ...clients[0],
      id: `client-${index}`,
    }));
    const repeatedDisputes = Array.from({ length: 8 }, (_, index) => ({
      ...disputes[0],
      id: `dispute-${index}`,
    }));

    const results = searchWorkspaceRecords({
      query: 'jane',
      clients: repeatedClients,
      disputes: repeatedDisputes,
      limitPerKind: 3,
    });

    expect(results.filter((result) => result.kind === 'client')).toHaveLength(3);
    expect(results.filter((result) => result.kind === 'dispute')).toHaveLength(3);
  });

  it('returns no result for a short query and never copies sensitive source fields', () => {
    const results = searchWorkspaceRecords({
      query: 'jane',
      clients: [{ ...clients[0], phone: '555-0101', ssnLast4: '1234' }],
      disputes: [{ ...disputes[0], accountNumber: '9999', letterContent: 'private' }],
    });

    expect(searchWorkspaceRecords({ query: 'j', clients, disputes })).toEqual([]);
    expect(JSON.stringify(results)).not.toContain('555-0101');
    expect(JSON.stringify(results)).not.toContain('1234');
    expect(JSON.stringify(results)).not.toContain('9999');
    expect(JSON.stringify(results)).not.toContain('private');
  });
});

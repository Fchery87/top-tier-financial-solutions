import { describe, expect, it } from 'vitest';

import { findDisputeFromQuery } from '@/lib/workspace-dispute-navigation';

const disputes = [
  { id: 'dispute-1', client_name: 'Jane Doe' },
  { id: 'dispute-2', client_name: 'Janet Smith' },
];

describe('workspace dispute navigation', () => {
  it('finds the requested dispute once the list has loaded', () => {
    expect(findDisputeFromQuery(disputes, 'dispute-2')).toEqual(disputes[1]);
  });

  it('returns null for a missing or unknown query id', () => {
    expect(findDisputeFromQuery(disputes, null)).toBeNull();
    expect(findDisputeFromQuery(disputes, 'missing')).toBeNull();
  });
});

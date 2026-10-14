import { describe, expect, it, vi } from 'vitest';

vi.mock('@/db/client', () => ({ db: {} }));

import { describeUnusedEvidence } from '@/lib/new-facts';

describe('describeUnusedEvidence', () => {
  it('turns each unused evidence packet with documents into a new fact', () => {
    expect(describeUnusedEvidence([
      { id: 'packet-1', claimType: 'payment_record', documentIds: '["doc-1","doc-2"]' },
      { id: 'packet-2', claimType: 'never_late', documentIds: '["doc-3"]' },
    ])).toEqual([
      { description: 'client-supplied payment record evidence (2 documents) not included in an earlier dispute', evidencePacketId: 'packet-1' },
      { description: 'client-supplied never late evidence (1 document) not included in an earlier dispute', evidencePacketId: 'packet-2' },
    ]);
  });

  it('ignores packets that hold no documents', () => {
    expect(describeUnusedEvidence([
      { id: 'packet-1', claimType: 'payment_record', documentIds: '[]' },
      { id: 'packet-2', claimType: 'payment_record', documentIds: 'not json' },
    ])).toEqual([]);
  });
});

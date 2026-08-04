import { describe, expect, it } from 'vitest';
import { disputes, evidencePackets } from '@/db/schema';

describe('secure evidence document schema', () => {
  it('keeps a durable response document reference on disputes', () => {
    expect(disputes.responseDocumentId).toBeDefined();
  });

  it('attributes evidence packets to the staff member who created them', () => {
    expect(evidencePackets.createdById).toBeDefined();
  });
});

import { describe, expect, it } from 'vitest';
import { evaluateDisputeCycleDraft } from '@/lib/dispute-cycle-workflow';

describe('evaluateDisputeCycleDraft', () => {
  it('requires item selection before creating a Dispute Cycle draft', () => {
    expect(evaluateDisputeCycleDraft({ itemSelection: [] })).toMatchObject({
      allowed: false,
      code: 'DISPUTE_CYCLE_ITEM_SELECTION_REQUIRED',
    });

    expect(evaluateDisputeCycleDraft({ itemSelection: ['item-1'] })).toMatchObject({
      allowed: true,
      code: null,
    });
  });
});

export function evaluateDisputeCycleDraft(params: { itemSelection: unknown[] }) {
  if (params.itemSelection.length === 0) {
    return {
      allowed: false,
      code: 'DISPUTE_CYCLE_ITEM_SELECTION_REQUIRED',
      reason: 'Dispute Cycle drafts require at least one selected item',
    };
  }

  return {
    allowed: true,
    code: null,
    reason: null,
  };
}

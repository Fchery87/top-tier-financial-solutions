import { PRESET_DISPUTE_INSTRUCTIONS } from '@/lib/dispute-wizard-utils';

export interface CreateDisputeFormState {
  clientId: string;
  negativeItemId: string;
  bureau: string;
  disputeReason: string;
  disputeType: string;
  /** Chosen by the staff member; never inferred from the free-text reason. */
  reasonCode: string;
}

/**
 * Reason codes a staff member can choose in the Disputes tab. Ownership claims
 * need evidence and client confirmation, which this quick form cannot attach,
 * so they stay in the Dispute Wizard.
 */
export const CREATE_DISPUTE_REASON_OPTIONS = PRESET_DISPUTE_INSTRUCTIONS
  .filter(preset => preset.category !== 'custom' && preset.category !== 'ownership_claim')
  .map(preset => ({ code: preset.code, label: preset.label }));

/** Builds the POST /api/workspace/disputes body sent by the client profile's Disputes tab. */
export function buildCreateDisputeRequestBody(form: CreateDisputeFormState) {
  return {
    clientId: form.clientId,
    negativeItemId: form.negativeItemId,
    bureau: form.bureau,
    disputeReason: form.disputeReason,
    disputeType: form.disputeType,
    reasonCodes: [form.reasonCode],
  };
}

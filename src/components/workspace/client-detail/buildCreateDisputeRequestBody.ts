export interface CreateDisputeFormState {
  clientId: string;
  negativeItemId: string;
  bureau: string;
  disputeReason: string;
  disputeType: string;
}

/** Builds the POST /api/workspace/disputes body sent by the client profile's Disputes tab. */
export function buildCreateDisputeRequestBody(form: CreateDisputeFormState) {
  return {
    clientId: form.clientId,
    negativeItemId: form.negativeItemId,
    bureau: form.bureau,
    disputeReason: form.disputeReason,
    disputeType: form.disputeType,
  };
}

export const cancellationWindowActions = [
  'administrative_onboarding',
  'prepare_dispute_strategy',
  'draft_dispute_letter',
  'contact_third_party',
  'submit_dispute',
  'mark_services_rendered',
  'create_payable_invoice',
  'charge_client',
] as const;

export type CancellationWindowAction = (typeof cancellationWindowActions)[number];

type EvaluationParams = {
  inCancellationWindow: boolean;
  action: CancellationWindowAction;
};

const blockedDuringCancellationWindow = new Set<CancellationWindowAction>([
  'contact_third_party',
  'submit_dispute',
  'mark_services_rendered',
  'create_payable_invoice',
  'charge_client',
]);

export function evaluateCancellationWindowAction(params: EvaluationParams) {
  if (params.inCancellationWindow && blockedDuringCancellationWindow.has(params.action)) {
    return {
      allowed: false,
      reason: 'Cancellation Window blocks external execution, billing, and charging',
    };
  }

  return { allowed: true, reason: null };
}

type BillingReadinessParams = {
  hasQualifyingServicesRenderedEvent: boolean;
  feeModel?: string | null;
  hasVerifiedResult?: boolean;
};

export type BillingReadinessCode =
  | 'SERVICES_RENDERED_EVENT_REQUIRED'
  | 'RESULTS_VERIFIED_BILLING_LOCK'
  | null;

type BillingReadiness =
  | {
      payable: false;
      code: Exclude<BillingReadinessCode, null>;
      reason: string;
    }
  | {
      payable: true;
      code: null;
      reason: null;
    };

export function evaluateBillingReadiness(params: BillingReadinessParams): BillingReadiness {
  if (!params.hasQualifyingServicesRenderedEvent) {
    return {
      payable: false,
      code: 'SERVICES_RENDERED_EVENT_REQUIRED',
      reason: 'A qualifying Services Rendered event is required before an invoice can become payable',
    };
  }

  if (params.feeModel === 'pay_per_delete' && params.hasVerifiedResult !== true) {
    return {
      payable: false,
      code: 'RESULTS_VERIFIED_BILLING_LOCK',
      reason: 'Result-based fees require verified result documentation before an invoice can become payable',
    };
  }

  return {
    payable: true,
    code: null,
    reason: null,
  };
}

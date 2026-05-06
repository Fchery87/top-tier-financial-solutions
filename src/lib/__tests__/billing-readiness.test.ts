import { describe, expect, it } from 'vitest';
import { evaluateBillingReadiness } from '@/lib/billing-readiness';

describe('evaluateBillingReadiness', () => {
  it('keeps result-based fees locked until the result is verified', () => {
    expect(evaluateBillingReadiness({
      hasQualifyingServicesRenderedEvent: true,
      feeModel: 'pay_per_delete',
      hasVerifiedResult: false,
    })).toMatchObject({
      payable: false,
      code: 'RESULTS_VERIFIED_BILLING_LOCK',
    });

    expect(evaluateBillingReadiness({
      hasQualifyingServicesRenderedEvent: true,
      feeModel: 'pay_per_delete',
      hasVerifiedResult: true,
    })).toMatchObject({
      payable: true,
      code: null,
    });
  });
});

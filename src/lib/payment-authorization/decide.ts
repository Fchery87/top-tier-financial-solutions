import { evaluateBillingReadiness, type BillingReadinessCode } from '@/lib/billing-readiness';
import { evaluateComplianceGateAction } from '@/lib/compliance-gate';
import type { ChargeFacts, ChargeRefusal } from './types';

type ReadinessResult = {
  payable: boolean;
  code: BillingReadinessCode | string | null;
  reason: string | null;
};

export function decideChargeRefusal(facts: ChargeFacts): ChargeRefusal {
  if (facts.invoiceStatus !== 'pending') {
    throw new Error('Only a pending invoice can be submitted for collection');
  }

  if (!facts.authorization || facts.authorization.status !== 'active') {
    return { outcome: 'blocked_no_authorization' };
  }

  const gate = evaluateComplianceGateAction({
    records: facts.gateRecords,
    action: 'charge_client',
  });
  if (!gate.allowed) {
    return { outcome: 'blocked_compliance_gate', blockingChecks: gate.blockingChecks };
  }

  const readiness = evaluateBillingReadiness({
    hasQualifyingServicesRenderedEvent: facts.hasQualifyingServicesRenderedEvent,
    feeModel: facts.feeModel,
    hasVerifiedResult: facts.hasVerifiedResult,
  }) as ReadinessResult;

  switch (readiness.code) {
    case 'SERVICES_RENDERED_EVENT_REQUIRED':
      return { outcome: 'blocked_services_not_rendered' };
    case 'RESULTS_VERIFIED_BILLING_LOCK':
      return { outcome: 'blocked_results_not_verified' };
    case null:
      break;
    default:
      throw new Error(`Unknown billing readiness code: ${readiness.code}`);
  }

  if (!readiness.payable) {
    throw new Error('Unknown billing readiness code');
  }

  if (facts.invoiceAmountCents > facts.authorization.maximumAmountCents) {
    return {
      outcome: 'blocked_above_cap',
      invoiceAmountCents: facts.invoiceAmountCents,
      maximumAmountCents: facts.authorization.maximumAmountCents,
    };
  }

  if (facts.engagementStatus !== 'closed' || facts.engagementClosedAt == null) {
    return { outcome: 'blocked_services_not_complete' };
  }

  return { outcome: 'blocked_instrument' };
}

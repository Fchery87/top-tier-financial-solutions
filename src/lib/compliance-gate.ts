export const COMPLIANCE_GATE_CHECKS = [
  { key: 'client_identity_linked', label: 'Client identity linked' },
  { key: 'service_agreement_signed', label: 'Service agreement signed' },
  { key: 'croa_disclosure_acknowledged', label: 'CROA disclosure acknowledged' },
  { key: 'notice_of_cancellation_delivered', label: 'Notice of cancellation delivered' },
  { key: 'cancellation_deadline_calculated', label: 'Cancellation deadline calculated' },
  { key: 'cancellation_window_complete', label: 'Cancellation window complete' },
  { key: 'identity_document_uploaded', label: 'Identity document uploaded' },
  { key: 'proof_of_address_uploaded', label: 'Proof of address uploaded' },
  { key: 'credit_report_consent_captured', label: 'Credit report consent captured' },
  { key: 'fee_terms_disclosed', label: 'Fee terms disclosed' },
  { key: 'no_upfront_payment_collected', label: 'No upfront payment collected' },
  { key: 'onboarding_review_complete', label: 'Onboarding review complete' },
] as const;

export type ComplianceGateCheckKey = (typeof COMPLIANCE_GATE_CHECKS)[number]['key'];

export type ComplianceGateCheckRecord = {
  checkKey: string;
  passed: boolean;
  checkedAt: Date | null;
  notes: string | null;
};

export type ComplianceGateAction =
  | 'mark_services_rendered'
  | 'create_payable_invoice'
  | 'charge_client'
  | 'submit_dispute';

export function buildComplianceGateStatus(records: ComplianceGateCheckRecord[]) {
  const byKey = new Map(records.map((record) => [record.checkKey, record]));

  const checks = COMPLIANCE_GATE_CHECKS.map((definition) => {
    const record = byKey.get(definition.key);
    return {
      key: definition.key,
      label: definition.label,
      passed: record?.passed === true,
      checked_at: record?.checkedAt?.toISOString() || null,
      notes: record?.notes || null,
    };
  });

  return {
    checks,
    is_ready_for_first_work: checks.every((check) => check.passed),
  };
}

export function getBlockingComplianceGateChecks(records: ComplianceGateCheckRecord[]) {
  return buildComplianceGateStatus(records)
    .checks
    .filter((check) => !check.passed)
    .map((check) => check.key);
}

export function evaluateComplianceGateAction(params: {
  records: ComplianceGateCheckRecord[];
  action: ComplianceGateAction;
}) {
  const blockingChecks = getBlockingComplianceGateChecks(params.records);

  if (blockingChecks.length > 0) {
    return {
      allowed: false,
      code: 'COMPLIANCE_GATE_BLOCKED',
      reason: 'Compliance Gate must pass before external execution, billing, or charging',
      blockingChecks,
      action: params.action,
    };
  }

  return {
    allowed: true,
    code: null,
    reason: null,
    blockingChecks,
    action: params.action,
  };
}

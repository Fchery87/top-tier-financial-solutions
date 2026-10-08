export type ComplianceGateCheckSource = 'derived' | 'attested';

export const COMPLIANCE_GATE_CHECKS = [
  { key: 'client_identity_linked', label: 'Client identity linked', source: 'derived' },
  { key: 'service_agreement_signed', label: 'Service agreement signed', source: 'derived' },
  { key: 'croa_disclosure_acknowledged', label: 'CROA disclosure acknowledged', source: 'derived' },
  { key: 'notice_of_cancellation_delivered', label: 'Notice of cancellation delivered', source: 'attested' },
  { key: 'cancellation_deadline_calculated', label: 'Cancellation deadline calculated', source: 'derived' },
  { key: 'cancellation_window_complete', label: 'Cancellation window complete', source: 'derived' },
  { key: 'identity_document_uploaded', label: 'Identity document uploaded', source: 'derived' },
  { key: 'proof_of_address_uploaded', label: 'Proof of address uploaded', source: 'derived' },
  { key: 'credit_report_consent_captured', label: 'Credit report consent captured', source: 'attested' },
  { key: 'fee_terms_disclosed', label: 'Fee terms disclosed', source: 'derived' },
  { key: 'no_upfront_payment_collected', label: 'No upfront payment collected', source: 'derived' },
  { key: 'onboarding_review_complete', label: 'Onboarding review complete', source: 'attested' },
] as const satisfies readonly { key: string; label: string; source: ComplianceGateCheckSource }[];

export type ComplianceGateCheckKey = (typeof COMPLIANCE_GATE_CHECKS)[number]['key'];

export type DerivedComplianceGateCheckKey = Extract<
  (typeof COMPLIANCE_GATE_CHECKS)[number],
  { source: 'derived' }
>['key'];

export type AttestedComplianceGateCheckKey = Extract<
  (typeof COMPLIANCE_GATE_CHECKS)[number],
  { source: 'attested' }
>['key'];

export function isAttestedCheckKey(key: string): key is AttestedComplianceGateCheckKey {
  return COMPLIANCE_GATE_CHECKS.some((check) => check.key === key && check.source === 'attested');
}

export function isDerivedCheckKey(key: string): key is DerivedComplianceGateCheckKey {
  return COMPLIANCE_GATE_CHECKS.some((check) => check.key === key && check.source === 'derived');
}

export type ComplianceGateCheckRecord = {
  checkKey: string;
  passed: boolean;
  checkedAt: Date | null;
  notes: string | null;
};

/** Everything the derived checks need, loaded once per engagement. */
export type ComplianceGateFacts = {
  clientUserId: string | null;
  signedAgreement: {
    cancellationDeadline: Date | null;
    cancelledAt: Date | null;
    feeTermsSnapshot: string | null;
    disclosures: { acknowledged: boolean }[];
  } | null;
  /** Output of buildDocumentChecklist, so the document rules live in one place. */
  documentChecklist: { key: string; completed: boolean }[];
  firstServicesRenderedAt: Date | null;
  paymentReceivedAts: Date[];
};

export function deriveComplianceGateChecks(
  facts: ComplianceGateFacts,
  now: Date,
): ComplianceGateCheckRecord[] {
  const agreement = facts.signedAgreement;
  const documentCompleted = (key: string) =>
    facts.documentChecklist.some((item) => item.key === key && item.completed);

  const result = (passed: boolean, failure: string): Omit<ComplianceGateCheckRecord, 'checkKey'> => ({
    passed,
    checkedAt: now,
    notes: passed ? null : failure,
  });

  const checks: Record<DerivedComplianceGateCheckKey, Omit<ComplianceGateCheckRecord, 'checkKey'>> = {
    client_identity_linked: result(
      Boolean(facts.clientUserId),
      'Client has no linked portal account',
    ),
    service_agreement_signed: result(Boolean(agreement), 'No signed service agreement'),
    croa_disclosure_acknowledged: result(
      Boolean(agreement)
        && agreement!.disclosures.length > 0
        && agreement!.disclosures.every((disclosure) => disclosure.acknowledged),
      agreement ? 'Not every required disclosure is acknowledged' : 'No signed service agreement',
    ),
    cancellation_deadline_calculated: result(
      Boolean(agreement?.cancellationDeadline),
      agreement ? 'Signed agreement has no cancellation deadline' : 'No signed service agreement',
    ),
    cancellation_window_complete: result(
      Boolean(agreement?.cancellationDeadline)
        && !agreement!.cancelledAt
        && agreement!.cancellationDeadline!.getTime() < now.getTime(),
      agreement?.cancelledAt
        ? 'Agreement was cancelled'
        : agreement?.cancellationDeadline
          ? 'Cancellation window is still open'
          : 'No cancellation deadline',
    ),
    identity_document_uploaded: result(
      documentCompleted('identity_document'),
      'No identity document uploaded',
    ),
    proof_of_address_uploaded: result(
      documentCompleted('proof_of_address'),
      'No proof of address uploaded',
    ),
    fee_terms_disclosed: result(
      Boolean(agreement?.feeTermsSnapshot),
      agreement ? 'Signed agreement does not include fee terms' : 'No signed service agreement',
    ),
    no_upfront_payment_collected: result(
      facts.paymentReceivedAts.every((receivedAt) =>
        facts.firstServicesRenderedAt !== null
        && receivedAt.getTime() >= facts.firstServicesRenderedAt.getTime()),
      'A payment was received before services were rendered',
    ),
  };

  return COMPLIANCE_GATE_CHECKS
    .filter((definition) => definition.source === 'derived')
    .map((definition) => ({
      checkKey: definition.key,
      ...checks[definition.key as DerivedComplianceGateCheckKey],
    }));
}

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
      source: definition.source,
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

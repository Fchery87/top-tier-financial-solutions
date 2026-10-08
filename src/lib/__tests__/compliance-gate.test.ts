import { describe, expect, it } from 'vitest';
import {
  COMPLIANCE_GATE_CHECKS,
  deriveComplianceGateChecks,
  evaluateComplianceGateAction,
  isAttestedCheckKey,
  type ComplianceGateCheckRecord,
  type ComplianceGateFacts,
} from '@/lib/compliance-gate';

const passedRecords: ComplianceGateCheckRecord[] = COMPLIANCE_GATE_CHECKS.map((check) => ({
  checkKey: check.key,
  passed: true,
  checkedAt: new Date('2026-01-01T00:00:00.000Z'),
  notes: null,
}));

describe('evaluateComplianceGateAction', () => {
  it('blocks Services Rendered recording until the Compliance Gate passes', () => {
    expect(evaluateComplianceGateAction({
      records: passedRecords.filter((record) => record.checkKey !== 'cancellation_window_complete'),
      action: 'mark_services_rendered',
    })).toMatchObject({
      allowed: false,
      code: 'COMPLIANCE_GATE_BLOCKED',
      blockingChecks: ['cancellation_window_complete'],
    });
  });

  it('allows Services Rendered recording after every Compliance Gate check passes', () => {
    expect(evaluateComplianceGateAction({
      records: passedRecords,
      action: 'mark_services_rendered',
    })).toMatchObject({
      allowed: true,
      code: null,
      blockingChecks: [],
    });
  });
});

describe('deriveComplianceGateChecks', () => {
  const now = new Date('2026-03-10T12:00:00.000Z');
  const completeFacts: ComplianceGateFacts = {
    clientUserId: 'user-1',
    signedAgreement: {
      cancellationDeadline: new Date('2026-03-05T00:00:00.000Z'),
      cancelledAt: null,
      feeTermsSnapshot: 'Standard plan: $99.00 per month',
      disclosures: [{ acknowledged: true }, { acknowledged: true }],
    },
    documentChecklist: [
      { key: 'identity_document', completed: true },
      { key: 'proof_of_address', completed: true },
    ],
    firstServicesRenderedAt: new Date('2026-03-08T00:00:00.000Z'),
    paymentReceivedAts: [new Date('2026-03-09T00:00:00.000Z')],
  };

  const byKey = (records: ComplianceGateCheckRecord[]) =>
    Object.fromEntries(records.map((record) => [record.checkKey, record.passed]));

  it('passes every derived check when the facts are complete', () => {
    const records = deriveComplianceGateChecks(completeFacts, now);
    expect(records.map((record) => record.checkKey)).toEqual([
      'client_identity_linked',
      'service_agreement_signed',
      'croa_disclosure_acknowledged',
      'cancellation_deadline_calculated',
      'cancellation_window_complete',
      'identity_document_uploaded',
      'proof_of_address_uploaded',
      'fee_terms_disclosed',
      'no_upfront_payment_collected',
    ]);
    expect(records.every((record) => record.passed)).toBe(true);
    expect(records[0]).toEqual({ checkKey: 'client_identity_linked', passed: true, checkedAt: now, notes: null });
  });

  it('fails every agreement check when nothing is signed', () => {
    const records = deriveComplianceGateChecks({
      clientUserId: null,
      signedAgreement: null,
      documentChecklist: [
        { key: 'identity_document', completed: false },
        { key: 'proof_of_address', completed: false },
      ],
      firstServicesRenderedAt: null,
      paymentReceivedAts: [],
    }, now);

    expect(byKey(records)).toEqual({
      client_identity_linked: false,
      service_agreement_signed: false,
      croa_disclosure_acknowledged: false,
      cancellation_deadline_calculated: false,
      cancellation_window_complete: false,
      identity_document_uploaded: false,
      proof_of_address_uploaded: false,
      fee_terms_disclosed: false,
      no_upfront_payment_collected: true,
    });
    expect(records.find((record) => record.checkKey === 'service_agreement_signed')?.notes)
      .toBe('No signed service agreement');
  });

  it('requires at least one disclosure and every disclosure acknowledged', () => {
    const none = deriveComplianceGateChecks({
      ...completeFacts,
      signedAgreement: { ...completeFacts.signedAgreement!, disclosures: [] },
    }, now);
    const partial = deriveComplianceGateChecks({
      ...completeFacts,
      signedAgreement: { ...completeFacts.signedAgreement!, disclosures: [{ acknowledged: true }, { acknowledged: false }] },
    }, now);

    expect(byKey(none).croa_disclosure_acknowledged).toBe(false);
    expect(byKey(partial).croa_disclosure_acknowledged).toBe(false);
    expect(partial.find((record) => record.checkKey === 'croa_disclosure_acknowledged')?.notes)
      .toBe('Not every required disclosure is acknowledged');
  });

  it('keeps the cancellation window open until the deadline passes and closed for a cancelled agreement', () => {
    const open = deriveComplianceGateChecks({
      ...completeFacts,
      signedAgreement: { ...completeFacts.signedAgreement!, cancellationDeadline: new Date('2026-03-10T12:00:00.000Z') },
    }, now);
    const cancelled = deriveComplianceGateChecks({
      ...completeFacts,
      signedAgreement: { ...completeFacts.signedAgreement!, cancelledAt: new Date('2026-03-04T00:00:00.000Z') },
    }, now);

    expect(byKey(open).cancellation_window_complete).toBe(false);
    expect(open.find((record) => record.checkKey === 'cancellation_window_complete')?.notes)
      .toBe('Cancellation window is still open');
    expect(byKey(cancelled).cancellation_window_complete).toBe(false);
    expect(cancelled.find((record) => record.checkKey === 'cancellation_window_complete')?.notes)
      .toBe('Agreement was cancelled');
  });

  it('fails fee terms when the signed agreement has no snapshot', () => {
    const records = deriveComplianceGateChecks({
      ...completeFacts,
      signedAgreement: { ...completeFacts.signedAgreement!, feeTermsSnapshot: null },
    }, now);
    expect(byKey(records).fee_terms_disclosed).toBe(false);
  });

  it('fails no-upfront-payment for a payment before the first services-rendered event', () => {
    const early = deriveComplianceGateChecks({
      ...completeFacts,
      paymentReceivedAts: [new Date('2026-03-07T23:59:59.000Z')],
    }, now);
    const sameInstant = deriveComplianceGateChecks({
      ...completeFacts,
      paymentReceivedAts: [new Date('2026-03-08T00:00:00.000Z')],
    }, now);

    expect(byKey(early).no_upfront_payment_collected).toBe(false);
    expect(byKey(sameInstant).no_upfront_payment_collected).toBe(true);
  });

  it('fails no-upfront-payment for any payment when no services-rendered event exists', () => {
    const records = deriveComplianceGateChecks({
      ...completeFacts,
      firstServicesRenderedAt: null,
      paymentReceivedAts: [new Date('2026-03-09T00:00:00.000Z')],
    }, now);
    expect(byKey(records).no_upfront_payment_collected).toBe(false);
  });
});

describe('compliance gate registry', () => {
  it('marks only the three staff-attested checks as attested', () => {
    expect(COMPLIANCE_GATE_CHECKS.filter((check) => check.source === 'attested').map((check) => check.key)).toEqual([
      'notice_of_cancellation_delivered',
      'credit_report_consent_captured',
      'onboarding_review_complete',
    ]);
    expect(isAttestedCheckKey('onboarding_review_complete')).toBe(true);
    expect(isAttestedCheckKey('fee_terms_disclosed')).toBe(false);
    expect(isAttestedCheckKey('not_a_check')).toBe(false);
  });
});

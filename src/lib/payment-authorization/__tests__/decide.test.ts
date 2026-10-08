import { describe, expect, it, vi } from 'vitest';
import { COMPLIANCE_GATE_CHECKS, type ComplianceGateCheckRecord } from '@/lib/compliance-gate';
import { decideChargeRefusal } from '@/lib/payment-authorization/decide';
import type { ActiveAuthorization, ChargeFacts } from '@/lib/payment-authorization/types';

const now = new Date('2026-06-01T00:00:00.000Z');

function passedGate(): ComplianceGateCheckRecord[] {
  return COMPLIANCE_GATE_CHECKS.map((check) => ({
    checkKey: check.key,
    passed: true,
    checkedAt: now,
    notes: null,
  }));
}

function authorization(overrides: Partial<ActiveAuthorization> = {}): ActiveAuthorization {
  return {
    status: 'active',
    id: 'auth-1',
    clientId: 'client-1',
    bankName: 'First Bank',
    accountLast4: '6789',
    accountType: 'checking',
    maximumAmountCents: 20000,
    signedAt: now,
    expiresAt: null,
    ...overrides,
  };
}

function facts(overrides: Partial<ChargeFacts> = {}): ChargeFacts {
  return {
    authorization: authorization(),
    invoiceStatus: 'pending',
    invoiceAmountCents: 15000,
    gateRecords: passedGate(),
    hasQualifyingServicesRenderedEvent: true,
    feeModel: 'flat_fee',
    hasVerifiedResult: false,
    engagementStatus: 'active',
    engagementClosedAt: null,
    ...overrides,
  };
}

describe('decideChargeRefusal', () => {
  it('refuses when there is no active authorization', () => {
    expect(decideChargeRefusal(facts({ authorization: null })).outcome).toBe('blocked_no_authorization');
  });

  it('refuses when the compliance gate has blockers', () => {
    const refusal = decideChargeRefusal(facts({
      gateRecords: passedGate().filter((record) => record.checkKey !== 'fee_terms_disclosed'),
    }));
    expect(refusal).toEqual({
      outcome: 'blocked_compliance_gate',
      blockingChecks: ['fee_terms_disclosed'],
    });
  });

  it('refuses when no qualifying services-rendered event exists', () => {
    expect(decideChargeRefusal(facts({ hasQualifyingServicesRenderedEvent: false })).outcome)
      .toBe('blocked_services_not_rendered');
  });

  it('refuses a pay-per-delete fee until the result is verified', () => {
    expect(decideChargeRefusal(facts({ feeModel: 'pay_per_delete', hasVerifiedResult: false })).outcome)
      .toBe('blocked_results_not_verified');
  });

  it('refuses an invoice above the signed maximum', () => {
    expect(decideChargeRefusal(facts({
      invoiceAmountCents: 25000,
      engagementStatus: 'closed',
      engagementClosedAt: now,
    }))).toEqual({
      outcome: 'blocked_above_cap',
      invoiceAmountCents: 25000,
      maximumAmountCents: 20000,
    });
  });

  it('refuses collection when the engagement is not closed', () => {
    expect(decideChargeRefusal(facts({
      engagementStatus: 'active',
      engagementClosedAt: null,
    })).outcome).toBe('blocked_services_not_complete');
  });

  it('refuses collection when the engagement is closed but closedAt is missing', () => {
    expect(decideChargeRefusal(facts({
      engagementStatus: 'closed',
      engagementClosedAt: null,
    })).outcome).toBe('blocked_services_not_complete');
  });

  it('still refuses the instrument after the engagement is closed and every earlier gate passes', () => {
    expect(decideChargeRefusal(facts({
      engagementStatus: 'closed',
      engagementClosedAt: now,
    }))).toEqual({ outcome: 'blocked_instrument' });
  });

  it('throws on an unknown readiness code instead of falling through', async () => {
    const readiness = await import('@/lib/billing-readiness');
    const spy = vi.spyOn(readiness, 'evaluateBillingReadiness').mockReturnValue({
      payable: false,
      code: 'SOME_FUTURE_LOCK',
      reason: 'not a known lock',
    } as never);

    expect(() => decideChargeRefusal(facts({
      engagementStatus: 'closed',
      engagementClosedAt: now,
    }))).toThrow(/Unknown billing readiness code/);
    spy.mockRestore();
  });

  it('throws when the invoice is not pending', () => {
    expect(() => decideChargeRefusal(facts({ invoiceStatus: 'paid' }))).toThrow(/pending invoice/);
  });
});

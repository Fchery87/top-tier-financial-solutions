import { vi } from 'vitest';
import {
  COMPLIANCE_GATE_CHECKS,
  deriveComplianceGateChecks,
  type ComplianceGateCheckRecord,
  type ComplianceGateFacts,
} from '@/lib/compliance-gate';

export const GATE_NOW = new Date('2026-03-10T12:00:00.000Z');

/** Facts for a client who has finished onboarding: every derived check passes. */
export const READY_GATE_FACTS: ComplianceGateFacts = {
  clientUserId: 'user-1',
  signedAgreement: {
    cancellationDeadline: new Date('2026-03-05T00:00:00.000Z'),
    cancelledAt: null,
    feeTermsSnapshot: 'Standard plan: $99.00 per month',
    disclosures: [{ acknowledged: true }],
  },
  documentChecklist: [
    { key: 'identity_document', completed: true },
    { key: 'proof_of_address', completed: true },
  ],
  firstServicesRenderedAt: null,
  paymentReceivedAts: [],
};

/**
 * What syncComplianceGate returns for these facts: the derived rows computed by the real
 * derivation, plus attested rows (all passed unless overridden).
 */
export function gateRecordsFor(
  facts: ComplianceGateFacts = READY_GATE_FACTS,
  attestedPassed: boolean = true,
): ComplianceGateCheckRecord[] {
  const attested = COMPLIANCE_GATE_CHECKS
    .filter((check) => check.source === 'attested')
    .map((check) => ({ checkKey: check.key, passed: attestedPassed, checkedAt: GATE_NOW, notes: 'Attested by staff' }));
  return [...deriveComplianceGateChecks(facts, GATE_NOW), ...attested];
}

/** A drizzle query-builder stand-in: every builder method chains, and awaiting it yields `result`. */
export function queryChain<T>(result: T) {
  const chain: Record<string, unknown> = {};
  for (const method of ['from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'limit', 'offset', 'for', 'groupBy', 'returning', 'values', 'set', 'onConflictDoUpdate', 'onConflictDoNothing']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (value: T) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<T>;
}

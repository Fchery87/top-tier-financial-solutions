import { describe, expect, it } from 'vitest';
import {
  COMPLIANCE_GATE_CHECKS,
  evaluateComplianceGateAction,
  type ComplianceGateCheckRecord,
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

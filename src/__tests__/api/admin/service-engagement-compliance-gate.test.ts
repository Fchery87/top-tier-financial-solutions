import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { READY_GATE_FACTS, gateRecordsFor } from '@/__tests__/fixtures/compliance-gate';

const requireCapabilityMock = vi.hoisted(() => vi.fn());
const syncMock = vi.hoisted(() => vi.fn());
const attestMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/admin-session', () => ({
  requireCapability: requireCapabilityMock,
}));

vi.mock('@/lib/compliance-gate-sync', () => ({
  syncComplianceGate: syncMock,
  attestComplianceGateCheck: attestMock,
}));

const context = { params: Promise.resolve({ id: 'engagement-1' }) };

function post(body: unknown) {
  return new NextRequest('http://localhost/api/workspace/service-engagements/engagement-1/compliance-gate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('GET /api/workspace/service-engagements/[id]/compliance-gate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'staff-1', email: 'staff@example.com', role: 'staff' });
  });

  it('syncs derived checks before returning the gate status', async () => {
    const { GET } = await import('@/app/api/workspace/service-engagements/[id]/compliance-gate/route');
    syncMock.mockResolvedValue(gateRecordsFor({ ...READY_GATE_FACTS, signedAgreement: null }, false));

    const response = await GET(
      new NextRequest('http://localhost/api/workspace/service-engagements/engagement-1/compliance-gate'),
      context,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(requireCapabilityMock).toHaveBeenCalledWith('agreements:read');
    expect(syncMock).toHaveBeenCalledWith('engagement-1');
    expect(body.engagement_id).toBe('engagement-1');
    expect(body.is_ready_for_first_work).toBe(false);
    expect(body.checks.filter((check: { passed: boolean }) => !check.passed).map((check: { key: string }) => check.key)).toEqual([
      'service_agreement_signed',
      'croa_disclosure_acknowledged',
      'notice_of_cancellation_delivered',
      'cancellation_deadline_calculated',
      'cancellation_window_complete',
      'credit_report_consent_captured',
      'fee_terms_disclosed',
      'onboarding_review_complete',
    ]);
    expect(body.checks[1]).toEqual({
      key: 'service_agreement_signed',
      label: 'Service agreement signed',
      source: 'derived',
      passed: false,
      checked_at: '2026-03-10T12:00:00.000Z',
      notes: 'No signed service agreement',
    });
  });

  it('returns 404 for an unknown engagement', async () => {
    const { GET } = await import('@/app/api/workspace/service-engagements/[id]/compliance-gate/route');
    syncMock.mockResolvedValue(null);

    const response = await GET(
      new NextRequest('http://localhost/api/workspace/service-engagements/engagement-1/compliance-gate'),
      context,
    );

    expect(response.status).toBe(404);
  });
});

describe('POST /api/workspace/service-engagements/[id]/compliance-gate', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    requireCapabilityMock.mockResolvedValue({ id: 'staff-1', email: 'staff@example.com', role: 'staff' });
  });

  it('rejects a derived check key with 400 and writes nothing', async () => {
    const { POST } = await import('@/app/api/workspace/service-engagements/[id]/compliance-gate/route');

    const response = await POST(post({ checkKey: 'fee_terms_disclosed', passed: true, notes: 'Looks fine' }), context);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('CHECK_NOT_ATTESTABLE');
    expect(attestMock).not.toHaveBeenCalled();
    expect(syncMock).not.toHaveBeenCalled();
  });

  it('rejects an attestation without a note', async () => {
    const { POST } = await import('@/app/api/workspace/service-engagements/[id]/compliance-gate/route');

    const response = await POST(post({ checkKey: 'onboarding_review_complete', passed: true, notes: '  ' }), context);

    expect(response.status).toBe(400);
    expect(attestMock).not.toHaveBeenCalled();
  });

  it('records an attested check as the signed-in staff member', async () => {
    const { POST } = await import('@/app/api/workspace/service-engagements/[id]/compliance-gate/route');
    syncMock.mockResolvedValue(gateRecordsFor());

    const response = await POST(post({
      checkKey: 'credit_report_consent_captured',
      passed: true,
      notes: ' Consent form on file ',
    }), context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(requireCapabilityMock).toHaveBeenCalledWith('agreements:write');
    expect(attestMock).toHaveBeenCalledWith({
      engagementId: 'engagement-1',
      checkKey: 'credit_report_consent_captured',
      passed: true,
      notes: 'Consent form on file',
      actorUserId: 'staff-1',
      now: expect.any(Date),
    });
    expect(body.is_ready_for_first_work).toBe(true);
  });

  it('returns 404 and writes nothing for an unknown engagement', async () => {
    const { POST } = await import('@/app/api/workspace/service-engagements/[id]/compliance-gate/route');
    syncMock.mockResolvedValue(null);

    const response = await POST(post({ checkKey: 'onboarding_review_complete', passed: true, notes: 'Done' }), context);

    expect(response.status).toBe(404);
    expect(attestMock).not.toHaveBeenCalled();
  });

  it('refuses a caller without the capability', async () => {
    const { POST } = await import('@/app/api/workspace/service-engagements/[id]/compliance-gate/route');
    requireCapabilityMock.mockResolvedValue(null);

    const response = await POST(post({ checkKey: 'onboarding_review_complete', passed: true, notes: 'Done' }), context);

    expect(response.status).toBe(403);
    expect(attestMock).not.toHaveBeenCalled();
  });
});

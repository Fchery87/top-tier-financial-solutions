import { describe, expect, it } from 'vitest';
import { evaluateCancellationWindowAction } from '@/lib/cancellation-window-policy';

describe('evaluateCancellationWindowAction', () => {
  it('allows administrative onboarding and internal dispute preparation during the cancellation window', () => {
    expect(evaluateCancellationWindowAction({ inCancellationWindow: true, action: 'administrative_onboarding' })).toMatchObject({ allowed: true });
    expect(evaluateCancellationWindowAction({ inCancellationWindow: true, action: 'prepare_dispute_strategy' })).toMatchObject({ allowed: true });
    expect(evaluateCancellationWindowAction({ inCancellationWindow: true, action: 'draft_dispute_letter' })).toMatchObject({ allowed: true });
  });

  it('blocks external execution and billing actions during the cancellation window', () => {
    const blockedActions = [
      'contact_third_party',
      'submit_dispute',
      'mark_services_rendered',
      'create_payable_invoice',
      'charge_client',
    ] as const;

    for (const action of blockedActions) {
      expect(evaluateCancellationWindowAction({ inCancellationWindow: true, action })).toMatchObject({
        allowed: false,
        reason: 'Cancellation Window blocks external execution, billing, and charging',
      });
    }
  });

  it('allows execution and billing actions after the cancellation window', () => {
    expect(evaluateCancellationWindowAction({ inCancellationWindow: false, action: 'submit_dispute' })).toMatchObject({ allowed: true });
    expect(evaluateCancellationWindowAction({ inCancellationWindow: false, action: 'create_payable_invoice' })).toMatchObject({ allowed: true });
  });
});

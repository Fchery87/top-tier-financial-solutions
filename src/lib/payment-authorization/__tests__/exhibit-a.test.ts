import { describe, expect, it } from 'vitest';
import { NY_SERVICE_AGREEMENT_TEMPLATE } from '@/lib/service-agreement-template';
import {
  EXHIBIT_A_PAYMENT_COPY,
  assertAgreementHasNoAccountPlaceholders,
} from '@/lib/payment-authorization/exhibit-a';

const FORBIDDEN = [
  '{{routing_number}}',
  '{{account_last4}}',
  '{{bank_name}}',
  '{{payment_method}}',
  '{{billing_date}}',
];

describe('exhibit A payment copy', () => {
  it('does not leave bank account placeholders in the agreement template', () => {
    for (const token of FORBIDDEN) {
      expect(NY_SERVICE_AGREEMENT_TEMPLATE).not.toContain(token);
    }
    expect(NY_SERVICE_AGREEMENT_TEMPLATE).toContain(EXHIBIT_A_PAYMENT_COPY);
    expect(NY_SERVICE_AGREEMENT_TEMPLATE).toContain('{{initial_payment_auth}}');
    expect(() => assertAgreementHasNoAccountPlaceholders(NY_SERVICE_AGREEMENT_TEMPLATE)).not.toThrow();
  });

  it('throws when a rendered string still contains an account placeholder', () => {
    expect(() => assertAgreementHasNoAccountPlaceholders('Account {{routing_number}}')).toThrow(/routing_number/);
  });
});

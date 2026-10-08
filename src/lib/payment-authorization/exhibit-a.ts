export const EXHIBIT_A_PAYMENT_COPY =
  'No bank account is printed on this agreement. ' +
  'A payment authorization, if you sign one, is collected separately in the client portal, ' +
  'applies to future invoices up to a maximum you sign, and is not a recurring monthly debit. ' +
  'This firm does not create demand drafts and does not debit a bank account from this system.';

const FORBIDDEN_PLACEHOLDERS = [
  '{{routing_number}}',
  '{{account_last4}}',
  '{{bank_name}}',
  '{{payment_method}}',
  '{{billing_date}}',
] as const;

export function assertAgreementHasNoAccountPlaceholders(html: string): void {
  const found = FORBIDDEN_PLACEHOLDERS.filter((token) => html.includes(token));
  if (found.length > 0) {
    throw new Error(`Agreement still contains account placeholders: ${found.join(', ')}`);
  }
}

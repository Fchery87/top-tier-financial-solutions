import { formatCurrency } from '@/lib/format';
import type { FeeModel } from '@/lib/billing-readiness';

export type FeeTermsInput = {
  name: string;
  feeModel: FeeModel;
  amountCents: number;
  frequency: string | null;
  setupFeeCents: number;
};

const FEE_MODEL_LABEL: Record<FeeModel, string> = {
  flat_fee: 'Flat fee',
  subscription: 'Monthly subscription',
  pay_per_delete: 'Pay per deleted item',
  milestone: 'Milestone',
};

const FREQUENCY_LABEL: Record<string, string> = {
  monthly: 'per month',
  per_item: 'per deleted item',
  one_time: 'one time',
};

export const NO_ADVANCE_FEE_TERMS =
  'No fee may be collected until the services have been fully performed. You will not be charged any fee until after services are rendered.';

/** Plain-text fee terms. This exact text is stored as the agreement's fee terms snapshot. */
export function renderFeeTerms(plan: FeeTermsInput): string {
  const frequency = plan.frequency ? FREQUENCY_LABEL[plan.frequency] ?? plan.frequency : null;
  return [
    `Service package: ${plan.name}`,
    `Fee model: ${FEE_MODEL_LABEL[plan.feeModel]}`,
    `Fee: ${formatCurrency(plan.amountCents)}${frequency ? ` ${frequency}` : ''}`,
    `Setup fee: ${plan.setupFeeCents > 0 ? `${formatCurrency(plan.setupFeeCents)}, charged only after the first service is performed` : 'None'}`,
    NO_ADVANCE_FEE_TERMS,
  ].join('\n');
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function feeTermsHtml(feeTerms: string): string {
  return feeTerms
    .split('\n')
    .map((line) => `<p style="font-size: 12px; margin: 0 0 6px 0;">${escapeHtml(line)}</p>`)
    .join('');
}

/**
 * Replaces `{{key}}` with the HTML-escaped value. `trustedHtml` keys are inserted as-is and must
 * already be built from escaped text. One pass, so a substituted value that itself contains
 * `{{...}}` is never expanded. Unknown placeholders are left for later stages (signing).
 */
export function fillAgreementTemplate(
  template: string,
  values: Record<string, string>,
  trustedHtml: Record<string, string> = {},
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (placeholder, key: string) => {
    if (Object.hasOwn(trustedHtml, key)) return trustedHtml[key];
    if (Object.hasOwn(values, key)) return escapeHtml(values[key]);
    return placeholder;
  });
}

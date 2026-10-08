import { describe, expect, it } from 'vitest';
import { escapeHtml, feeTermsHtml, fillAgreementTemplate, renderFeeTerms } from '@/lib/agreement-content';

describe('renderFeeTerms', () => {
  it('states the plan, amount, frequency, setup fee and the no-advance-fee rule', () => {
    expect(renderFeeTerms({
      name: 'Standard Restoration',
      feeModel: 'subscription',
      amountCents: 9900,
      frequency: 'monthly',
      setupFeeCents: 4900,
    })).toBe([
      'Service package: Standard Restoration',
      'Fee model: Monthly subscription',
      'Fee: $99.00 per month',
      'Setup fee: $49.00, charged only after the first service is performed',
      'No fee may be collected until the services have been fully performed. You will not be charged any fee until after services are rendered.',
    ].join('\n'));
  });

  it('says None when there is no setup fee and omits a missing frequency', () => {
    const terms = renderFeeTerms({ name: 'Flat', feeModel: 'flat_fee', amountCents: 50000, frequency: null, setupFeeCents: 0 });
    expect(terms.split('\n').slice(1, 4)).toEqual(['Fee model: Flat fee', 'Fee: $500.00', 'Setup fee: None']);
  });
});

describe('fillAgreementTemplate', () => {
  it('escapes substituted values and leaves unknown placeholders for signing', () => {
    expect(fillAgreementTemplate(
      '<p>{{client_name}}</p><div>{{service_package}}</div><span>{{client_signature}}</span>',
      { client_name: '<img src=x onerror=alert(1)> O\'Neil & Co' },
      { service_package: feeTermsHtml('Plan <b>A</b>') },
    )).toBe(
      '<p>&lt;img src=x onerror=alert(1)&gt; O&#39;Neil &amp; Co</p>'
      + '<div><p style="font-size: 12px; margin: 0 0 6px 0;">Plan &lt;b&gt;A&lt;/b&gt;</p></div>'
      + '<span>{{client_signature}}</span>',
    );
  });

  it('does not expand placeholders that appear inside a substituted value', () => {
    expect(fillAgreementTemplate('{{client_name}}|{{service_package}}', { client_name: '{{service_package}}' }, { service_package: 'X' }))
      .toBe('{{service_package}}|X');
  });

  it('escapes every HTML-significant character', () => {
    expect(escapeHtml('<a href="x">\'&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  });
});

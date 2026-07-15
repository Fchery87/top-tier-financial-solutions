export const parserFixtures = {
  identityiq: {
    kind: 'html' as const,
    content: '<html><body><div>Your IdentityIQ Report</div><div id="CreditScore"></div><address-history></address-history></body></html>',
    expectedSource: 'identityiq',
    expectedBureau: undefined,
  },
  smartcredit: {
    kind: 'html' as const,
    content: '<html><body><div>SmartCredit Report</div><div class="sc-score">TransUnion Score 701</div></body></html>',
    expectedSource: 'smartcredit',
    expectedBureau: 'transunion',
  },
  privacyguard: {
    kind: 'html' as const,
    content: '<html><body><div>PrivacyGuard Report</div><div>Experian Score 688</div></body></html>',
    expectedSource: 'privacyguard',
    expectedBureau: 'experian',
  },
  myscoreiq: {
    kind: 'html' as const,
    content: '<html><body><div>MyScoreIQ Report</div><div>Equifax Score 702</div></body></html>',
    expectedSource: 'myscoreiq',
    expectedBureau: 'equifax',
  },
  annualcreditreport: {
    kind: 'html' as const,
    content: '<html><body><div>AnnualCreditReport.com</div><div>Disclosure Report</div></body></html>',
    expectedSource: 'annualcreditreport',
    expectedBureau: undefined,
  },
  transunion: {
    kind: 'html' as const,
    content: '<html><body><div>TransUnion Credit Report</div><div>TrueVision</div></body></html>',
    expectedSource: 'transunion',
    expectedBureau: 'transunion',
  },
  experian: {
    kind: 'html' as const,
    content: '<html><body><div>Experian Credit Report</div><div>FICO Score 8</div></body></html>',
    expectedSource: 'experian',
    expectedBureau: 'experian',
  },
  equifax: {
    kind: 'html' as const,
    content: '<html><body><div>Equifax Credit Report</div><div>myEquifax</div></body></html>',
    expectedSource: 'equifax',
    expectedBureau: 'equifax',
  },
  genericHtml: {
    kind: 'html' as const,
    content: '<html><body><table><tr><td>Creditor</td><td>Generic Bank</td></tr></table></body></html>',
    expectedSource: 'unknown',
    expectedBureau: undefined,
  },
  pdf: {
    kind: 'pdf' as const,
    content: 'Provided by IdentityIQ\nYour IdentityIQ Report',
    expectedSource: 'identityiq',
    expectedBureau: undefined,
  },
};

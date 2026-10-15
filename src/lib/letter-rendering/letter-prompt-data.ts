export const BUREAU_ADDRESSES: Record<string, string> = {
  transunion: `TransUnion Consumer Solutions
P.O. Box 2000
Chester, PA 19016-2000`,
  experian: `Experian
P.O. Box 4500
Allen, TX 75013`,
  equifax: `Equifax Information Services LLC
P.O. Box 740256
Atlanta, GA 30374-0256`,
  lexisnexis: `LexisNexis Risk Solutions Consumer Center
P.O. Box 105108
Atlanta, GA 30348-5108`,
  innovis: `Innovis Consumer Assistance
P.O. Box 530088
Atlanta, GA 30353-0088`,
  chexsystems: `Chex Systems, Inc.
Attn: Consumer Relations
P.O. Box 583399
Minneapolis, MN 55458`,
  ews: `Early Warning Services, LLC
Attn: Consumer Services
5801 N. Pima Road
Scottsdale, AZ 85250`,
};

export const REASON_CODE_DESCRIPTIONS: Record<string, string> = {
  unverified_account: 'I am requesting verification of this account under FCRA Section 611. Please confirm with the furnisher that each reported detail is complete and accurate, and correct or delete anything that cannot be verified.',
  inaccurate_reporting: 'The information being reported contains inaccuracies that do not reflect the true status of this account. I am disputing the accuracy of this data under the Fair Credit Reporting Act.',
  incomplete_data: 'This account is being reported with incomplete information, missing required Metro 2 data fields necessary for accurate credit reporting.',
  metro2_violation: 'This account contains Metro 2 format compliance violations. The reported data does not meet the "maximum possible accuracy" standard required under FCRA Section 607(b).',
  missing_dofd: 'This derogatory account does not report a Date of First Delinquency. FCRA Section 623(a)(5) requires the furnisher of a delinquent account that has been placed for collection, charged off, or subjected to a similar action to report that date, and the reporting period under FCRA Section 605(c) runs from it.',
  status_inconsistency: 'The account status conflicts with the payment rating and payment history reported for the same account. These fields cannot all be accurate at the same time.',
  balance_discrepancy: 'The reported balance information is inaccurate or inconsistent with other account data fields. This discrepancy indicates a data integrity failure.',
  verification_required: 'I am requesting a reasonable reinvestigation of this account under FCRA Section 611. Please confirm each disputed detail with the furnisher and correct or delete anything that cannot be verified.',
  medical_state_rule: 'This account is medical debt, and the law of the state where I live limits how medical debt may be reported.',
  medical_bureau_policy: "This medical collection should not appear under the credit bureaus' own published medical debt policy.",
  cross_bureau_mismatch: 'The credit bureaus report this same account with different details. They cannot all be accurate, so the information you report must be reinvestigated and corrected.',
  dofd_cross_bureau_mismatch: 'The date of first delinquency you report for this account is later than the date another credit bureau reports for the same account. The reporting period runs from that date, so it must be verified and corrected.',
  reaged_account: 'The date of first delinquency for this account has moved later since an earlier report. The date a delinquency began cannot change, so the account has been re-aged and must be corrected.',
  reinserted_item: 'This account was removed from my report and has reappeared. Deleted information may be reinserted only after the furnisher certifies it is complete and accurate, and only with written notice to me under FCRA Section 611(a)(5)(B).',
  changed_after_verification: 'You reported this account as verified, but its details have changed since then. The information you verified was not accurate, so it must be reinvestigated.',
  missing_dispute_flag: 'I continue to dispute this account, but it is not reported as disputed. The reporting is incomplete without that notation.',
  new_evidence: 'Since my last dispute I have information about this account that the earlier reinvestigation did not consider. Please conduct a new reinvestigation that takes it into account.',
  previously_disputed: 'This item has already been disputed previously and remains under challenge because the prior response did not resolve the reporting concerns.',
  request_verification_method: 'Please provide the specific method of verification used in your prior investigation, including how the disputed information was verified and with whom.',
  no_response: 'I did not receive a timely response to my prior dispute, so I am requesting reinvestigation and a complete written response.',
  repeat_verification: 'This item has been repeatedly verified without sufficient supporting detail or documentation to show that the reporting is complete and accurate.',
  fcra_non_compliance: 'Your handling of this dispute appears inconsistent with the investigation and accuracy duties required under the Fair Credit Reporting Act, so I am requesting corrective action and a compliant response.',
  not_mine: 'This account does not belong to me. I have never opened, authorized, or used this account.',
  never_late: 'The reported late payment history is inaccurate. I have always made payments on time for this account.',
  wrong_balance: 'The reported balance and/or payment amounts are incorrect and do not reflect accurate account information.',
  closed_by_consumer: 'This account was closed at my request, but it is being reported incorrectly.',
  obsolete: 'This information is obsolete. It is being reported beyond the period allowed by FCRA Section 605.',
  duplicate: 'This account appears multiple times on my credit report, which is a duplicate entry.',
  paid_collection: 'This collection account has been paid in full but is still being reported as unpaid.',
  identity_theft: 'This account was opened fraudulently as a result of identity theft.',
  wrong_status: 'The account status being reported is inaccurate and requires verification.',
  wrong_dates: 'The dates associated with this account are being reported incorrectly and require verification.',
  mixed_file: 'This account belongs to another consumer and has been incorrectly placed on my file.',
  unauthorized_inquiry: 'This inquiry was made without my authorization or permissible purpose.',
};

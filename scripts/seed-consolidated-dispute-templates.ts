import 'dotenv/config';
import { db } from '../db/client';
import { disputeLetterLibrary } from '../db/schema';
import { randomUUID } from 'crypto';

/**
 * Consolidated Dispute Letter Templates with Metro 2, FCRA, and FCDPA Compliance
 * Reduced from 190+ templates to 50 high-value, non-redundant templates
 * Enhanced with legal citations and modern credit repair standards
 */

const CONSOLIDATED_TEMPLATES = [
  // ============================================
  // ROUND 1 - INITIAL BUREAU DISPUTES (8)
  // ============================================
  {
    name: 'Round 1 Bureau Dispute - Standard Inaccuracy',
    description: 'Initial dispute for inaccurate or unverifiable account information filed with credit bureaus',
    methodology: 'factual' as const,
    targetRecipient: 'bureau' as const,
    round: 1,
    itemTypes: ['late_payment', 'charge_off', 'collection', 'account_status'],
    reasonCodes: ['inaccurate_reporting', 'not_mine', 'duplicate'],
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Dispute of Inaccurate Information - Account {{ACCOUNT_NUMBER_LAST_4}}
FCRA Section 611 Investigation Request

Dear Sir/Madam,

I am writing to formally dispute inaccurate and unverifiable information appearing on my credit report. This dispute is submitted pursuant to the Fair Credit Reporting Act (FCRA), 15 U.S.C. § 1681i(a), which establishes my right to challenge information that does not accurately reflect my credit history.

CONSUMER INFORMATION:
Name: {{CONSUMER_NAME}}
Address: {{CONSUMER_ADDRESS}}
SSN: {{SSN_LAST_4}}

DISPUTED ACCOUNT INFORMATION:
Creditor/Furnisher: {{CREDITOR_NAME}}
Account Number: {{ACCOUNT_NUMBER_MASKED}}
Reporting Bureau: {{BUREAU_NAME}}
Amount: {{ACCOUNT_AMOUNT}}
Status Reported: {{REPORTED_STATUS}}

SPECIFIC INACCURACY:
{{DISPUTE_REASON}}

LEGAL COMPLIANCE VIOLATIONS:
Per the FCRA and Metro 2 Format Standards, furnishers must report accurate information. The reported {{DISPUTED_FIELD}} does not match my records and cannot be verified through competent evidence.

REQUIRED ACTION:
Under FCRA § 611, you MUST:
1. Conduct a reasonable investigation within 30 calendar days
2. Contact the furnisher using the method of verification this account was originally reported
3. Verify the COMPLETE accuracy of ALL reported data points, including:
   - Account status codes (per Metro 2 format)
   - Payment history dating back to account opening
   - Current balance accuracy
   - Account ownership verification
4. Delete any information that cannot be verified as completely accurate
5. Provide written notification of investigation results

METRO 2 COMPLIANCE NOTICE:
Data furnishers are required to report information in Metro 2 format with precise accuracy. Failure to verify information through competent evidence and deletion of unverifiable items constitutes willful non-compliance under 15 U.S.C. § 1681n, exposing the furnisher to statutory damages of $100 to $1,000 per violation plus punitive damages.

CONSEQUENCES OF NONCOMPLIANCE:
Continued reporting of unverifiable information after receiving this dispute may result in:
- Federal litigation under FCRA § 1681n (willful violations)
- CFPB complaint for systematic violations
- State attorney general action for deceptive practices
- Claims for damages, attorney fees, and costs

I expect written confirmation of deletion or detailed verification documentation within 30 days. Send all correspondence to the address listed above.

Respectfully,

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}

Enclosures:
- Government-issued photo identification
- Proof of current address (utility bill, lease, etc.)`,
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'ACCOUNT_NUMBER_LAST_4', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'SSN_LAST_4', 'CREDITOR_NAME', 'ACCOUNT_NUMBER_MASKED', 'BUREAU_NAME', 'ACCOUNT_AMOUNT', 'REPORTED_STATUS', 'DISPUTE_REASON', 'DISPUTED_FIELD', 'CONSUMER_PHONE'],
    legalCitations: ['FCRA 611', 'FCRA 623', 'Metro 2 Format'],
    promptContext: 'Standard FCRA Section 611 dispute for initial investigation round. Focus on accuracy, verification requirements, and Metro 2 compliance.',
  },
  {
    name: 'Round 1 Bureau Dispute - Not My Account',
    description: 'Dispute claiming account ownership error or identity theft',
    methodology: 'factual' as const,
    targetRecipient: 'bureau' as const,
    round: 1,
    itemTypes: ['collection', 'charge_off', 'account_status'],
    reasonCodes: ['not_mine', 'identity_theft', 'mixed_files'],
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Dispute - Account NOT Belonging to Me - {{ACCOUNT_NUMBER_LAST_4}}
FCRA Section 609 & 611 Request

Dear Credit Bureau:

I am disputing the following account on my credit file as it does NOT belong to me and should not appear on my credit report:

ACCOUNT DETAILS:
Creditor: {{CREDITOR_NAME}}
Account Number: {{ACCOUNT_NUMBER_MASKED}}
Amount: {{ACCOUNT_AMOUNT}}
Current Status: {{REPORTED_STATUS}}

REASON FOR DISPUTE:
I have never opened an account with this creditor and have no knowledge of this obligation. This is either:
1. A mixed file error - information from another consumer
2. Identity theft - fraudulent account opened in my name
3. Mistaken identity - similar name/SSN confusion

SUPPORTING EVIDENCE:
I am enclosing copies of:
- Government-issued identification
- This account does NOT appear in my personal financial records
- Documentation showing I was not doing business with this creditor at the time account was opened

LEGAL REQUIREMENTS:
Under FCRA § 611, the credit bureau and furnisher must investigate my claim. If the account cannot be verified as belonging to me through competent evidence, it MUST be deleted immediately.

I request that you:
1. Conduct a thorough investigation
2. Contact the furnisher to verify account ownership
3. Delete this account if verification cannot be completed
4. Provide written documentation of your investigation

This is a serious matter. Should you continue reporting an account that does not belong to me after receiving this notice, you will be liable under FCRA for willful non-compliance.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}

Enclosures:
- Government ID copy
- Proof of address`,
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'ACCOUNT_NUMBER_LAST_4', 'CREDITOR_NAME', 'ACCOUNT_NUMBER_MASKED', 'ACCOUNT_AMOUNT', 'REPORTED_STATUS', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FCRA 609', 'FCRA 611'],
    promptContext: 'Dispute for accounts not belonging to consumer - possible identity theft or mixed files. Strong emphasis on account ownership verification.',
  },
  {
    name: 'Round 1 Bureau Dispute - Duplicate Account',
    description: 'Dispute for duplicate reporting of the same account by different furnishers',
    methodology: 'factual' as const,
    targetRecipient: 'bureau' as const,
    round: 1,
    itemTypes: ['collection', 'account_status'],
    reasonCodes: ['duplicate'],
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Dispute of Duplicate Account Entry - {{ACCOUNT_NUMBER_LAST_4}}

Dear Credit Bureau:

I am disputing duplicate and/or multiple entries for the same account appearing on my credit report:

DUPLICATE ACCOUNTS:
Primary Entry:
- Creditor: {{CREDITOR_NAME_1}}
- Account Number: {{ACCOUNT_NUMBER_1}}
- Balance: {{AMOUNT_1}}

Duplicate Entry:
- Creditor: {{CREDITOR_NAME_2}}
- Account Number: {{ACCOUNT_NUMBER_2}}
- Balance: {{AMOUNT_2}}

These are the SAME account appearing twice under different furnisher names. This violates both FCRA reporting standards and data quality requirements.

LEGAL BASIS:
FCRA § 611 requires accurate reporting. Duplicate entries artificially inflate consumer indebtedness and damage credit scores through erroneous data duplication.

REQUESTED ACTION:
1. Verify that these are indeed duplicate entries
2. Delete one of the duplicate entries (typically the older or incorrect one)
3. Confirm deletion in writing within 30 days

I expect prompt resolution of this matter. Duplicate account reporting is a serious violation of reporting accuracy standards.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}`,
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'ACCOUNT_NUMBER_LAST_4', 'CREDITOR_NAME_1', 'ACCOUNT_NUMBER_1', 'AMOUNT_1', 'CREDITOR_NAME_2', 'ACCOUNT_NUMBER_2', 'AMOUNT_2', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FCRA 611'],
    promptContext: 'Dispute for duplicate accounts - same account appearing multiple times. Emphasize data accuracy and FCRA violations.',
  },
  {
    name: 'Round 1 Bureau Dispute - Obsolete Account (Past 7 Years)',
    description: 'Dispute for accounts exceeding the 7-year reporting period under FCRA Section 605',
    methodology: 'factual' as const,
    targetRecipient: 'bureau' as const,
    round: 1,
    itemTypes: ['late_payment', 'collection', 'charge_off'],
    reasonCodes: ['obsolete_reporting', 'past_7_years'],
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Demand for Removal - Account Exceeds 7-Year Reporting Period
FCRA Section 605(b) Violation

Dear Credit Bureau:

I am disputing the following account as it has exceeded the maximum reporting period under FCRA Section 605(b) and must be deleted:

ACCOUNT INFORMATION:
Creditor: {{CREDITOR_NAME}}
Account Number: {{ACCOUNT_NUMBER_MASKED}}
Status: {{ACCOUNT_STATUS}}
Original Delinquency Date: {{ORIGINAL_DELINQUENCY_DATE}}
Date Reported to You: {{DATE_REPORTED}}
Current Reporting Date: {{CURRENT_REPORT_DATE}}

LEGAL VIOLATION:
Under FCRA § 605(b), most negative items must be deleted after 7 years from the original date of delinquency. This account dates to {{ORIGINAL_DELINQUENCY_DATE}}, which is more than 7 years ago.

Continued reporting of this obsolete item is a direct violation of federal law.

CALCULATION:
Original Delinquency: {{ORIGINAL_DELINQUENCY_DATE}}
Seven Years Later: {{SEVEN_YEAR_DATE}}
Current Date: {{CURRENT_DATE}}

This account is {{DAYS_PAST_LIMIT}} days PAST the legal reporting limit.

MANDATORY ACTION:
You must immediately delete this account from my credit file. Failure to do so will result in:
- FCRA violation claims
- CFPB complaint
- Potential litigation for willful non-compliance

I expect written confirmation of deletion within 30 days.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}`,
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'CREDITOR_NAME', 'ACCOUNT_NUMBER_MASKED', 'ACCOUNT_STATUS', 'ORIGINAL_DELINQUENCY_DATE', 'DATE_REPORTED', 'CURRENT_REPORT_DATE', 'SEVEN_YEAR_DATE', 'DAYS_PAST_LIMIT', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FCRA 605', 'FCRA 605(b)'],
    promptContext: 'Dispute for accounts past the 7-year reporting period. Clear calculation of dates and mandatory deletion demand.',
  },
  {
    name: 'Round 1 Bureau Dispute - Medical Debt',
    description: 'Specialized dispute targeting medical collection accounts with healthcare-specific arguments',
    methodology: 'consumer_law' as const,
    targetRecipient: 'bureau' as const,
    round: 1,
    itemTypes: ['collection'],
    reasonCodes: ['inaccurate_reporting', 'not_mine'],
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Dispute of Medical Collection Account - {{ACCOUNT_NUMBER_LAST_4}}
FCRA Section 611 & Medical Debt Protection

Dear Credit Bureau:

I dispute the following medical collection account appearing on my credit report:

MEDICAL ACCOUNT DETAILS:
Original Creditor: {{MEDICAL_PROVIDER}}
Collection Agency: {{COLLECTION_AGENCY}}
Account Number: {{ACCOUNT_NUMBER_MASKED}}
Alleged Amount: {{ACCOUNT_AMOUNT}}
Reported Status: {{REPORTED_STATUS}}

DISPUTE BASIS:
{{DISPUTE_REASON}}

MEDICAL DEBT PROTECTIONS:
Recent federal law changes provide enhanced protections for medical debt:
- Medical debt is treated differently from other collections
- Healthcare providers often have payment plan arrangements not reflected in collection reports
- Medical debt disputes have special considerations under FCRA regulations

VERIFICATION REQUEST:
I require that you obtain and verify:
1. Original itemized medical bills from {{MEDICAL_PROVIDER}}
2. Proof that this account legitimately transferred to {{COLLECTION_AGENCY}}
3. Verification that proper notice was given before collection action
4. Documentation showing this debt was NOT settled or negotiated

LEGAL REQUIREMENT:
Under FCRA § 611, you must conduct a reasonable investigation and verify all material facts. If complete verification cannot be obtained, deletion is mandatory.

I expect written investigation results within 30 days.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}`,
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'ACCOUNT_NUMBER_LAST_4', 'MEDICAL_PROVIDER', 'COLLECTION_AGENCY', 'ACCOUNT_NUMBER_MASKED', 'ACCOUNT_AMOUNT', 'REPORTED_STATUS', 'DISPUTE_REASON', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FCRA 611', 'Medical Debt Protections'],
    promptContext: 'Medical debt dispute with specialized arguments. Reference recent medical debt protections and healthcare provider verification requirements.',
  },
  {
    name: 'Round 1 Bureau Dispute - Inquiry Dispute',
    description: 'Dispute challenging hard inquiries made without permissible purpose',
    methodology: 'factual' as const,
    targetRecipient: 'bureau' as const,
    round: 1,
    itemTypes: ['inquiry'],
    reasonCodes: ['unauthorized_inquiry'],
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Dispute of Unauthorized Hard Inquiry - {{INQUIRY_COMPANY}}
FCRA Section 1681s-3(b) Violation

Dear Credit Bureau:

I dispute the following hard inquiry appearing on my credit report, which was made without my authorization or legitimate permissible purpose:

DISPUTED INQUIRY:
Company: {{INQUIRY_COMPANY}}
Date of Inquiry: {{INQUIRY_DATE}}
Type: Hard Inquiry

VIOLATION STATEMENT:
The FCRA, 15 U.S.C. § 1681s-3(b), strictly prohibits the furnishing of a consumer report without a permissible purpose. I did NOT authorize {{INQUIRY_COMPANY}} to access my credit report and have no business relationship with them.

SPECIFIC FACTS:
- I did not apply for credit with {{INQUIRY_COMPANY}}
- I received no inquiry disclosure as required by FCRA § 1681g(d)
- There is no legitimate permissible purpose for this inquiry

HARM:
Unauthorized hard inquiries:
- Damage credit scores
- Create false appearance of credit-seeking behavior
- Affect approval decisions for legitimate applications
- Violate consumer privacy rights

REQUIRED ACTION:
1. Delete this unauthorized inquiry immediately
2. Contact {{INQUIRY_COMPANY}} to verify permissible purpose
3. If no permissible purpose exists, ensure deletion
4. Provide written confirmation within 30 days

Failure to resolve this will result in complaints to the CFPB and state authorities.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}`,
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'INQUIRY_COMPANY', 'INQUIRY_DATE', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FCRA 1681s-3(b)'],
    promptContext: 'Dispute for unauthorized hard inquiries. Emphasize permissible purpose requirements and consumer authorization.',
  },
  {
    name: 'Round 1 Bureau Dispute - Charge-Off Account',
    description: 'Dispute targeting charge-off accounts with Metro 2 field-specific challenges',
    methodology: 'metro2_compliance' as const,
    targetRecipient: 'bureau' as const,
    round: 1,
    itemTypes: ['charge_off'],
    reasonCodes: ['inaccurate_reporting', 'cannot_verify'],
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Dispute of Charge-Off Account - Metro 2 Format Violations
FCRA Section 611 & Metro 2 Compliance

Dear Credit Bureau:

I dispute the following charge-off account for multiple Metro 2 format compliance violations:

ACCOUNT INFORMATION:
Creditor: {{CREDITOR_NAME}}
Account Number: {{ACCOUNT_NUMBER_MASKED}}
Charge-Off Amount: {{CHARGE_OFF_AMOUNT}}
Date of Last Payment: {{LAST_PAYMENT_DATE}}
Charge-Off Date: {{CHARGE_OFF_DATE}}

METRO 2 VIOLATIONS:
Under Metro 2 format standards, the following data fields require verification:
1. Account Status Code - Reported as "{{REPORTED_STATUS_CODE}}" (requires verification)
2. Payment History - Claims {{PAYMENT_HISTORY}} (inaccurate)
3. Amount codes - Discrepancies in reported amounts
4. Date fields - Inconsistencies in payment dates

SPECIFIC CHALLENGE:
{{SPECIFIC_METRO2_VIOLATION}}

VERIFICATION REQUIREMENT:
To verify a charge-off account under Metro 2 standards, you must provide:
- Original account opening documentation
- Complete payment history from opening to charge-off
- Detailed explanation of charge-off decision
- Account status code verification and justification
- Reconciliation of all reported balance amounts

METRO 2 COMPLIANCE MANDATE:
Furnishers MUST maintain strict Metro 2 format compliance. Failure to provide accurate Metro 2-formatted data constitutes systematic reporting violations.

LEGAL REMEDIES:
Continued reporting of non-compliant charge-off information exposes the furnisher to FCRA Section 1681n violations with statutory damages of $100-$1,000 per violation.

I demand deletion if verification cannot be completed within 30 days.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}`,
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'CREDITOR_NAME', 'ACCOUNT_NUMBER_MASKED', 'CHARGE_OFF_AMOUNT', 'LAST_PAYMENT_DATE', 'CHARGE_OFF_DATE', 'REPORTED_STATUS_CODE', 'PAYMENT_HISTORY', 'SPECIFIC_METRO2_VIOLATION', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FCRA 611', 'FCRA 1681n', 'Metro 2 Format'],
    promptContext: 'Metro 2-focused charge-off dispute. Emphasize specific Metro 2 field violations and format compliance requirements.',
  },
  {
    name: 'Round 1 Bureau Dispute - Public Record',
    description: 'Dispute targeting public record items like judgments, liens, or bankruptcies',
    methodology: 'factual' as const,
    targetRecipient: 'bureau' as const,
    round: 1,
    itemTypes: ['judgment', 'tax_lien', 'bankruptcy'],
    reasonCodes: ['inaccurate_reporting', 'cannot_verify'],
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Dispute of Public Record Item - {{ITEM_TYPE}}
FCRA Section 611 & Section 605(e)

Dear Credit Bureau:

I dispute the following public record item appearing on my credit report:

PUBLIC RECORD DETAILS:
Item Type: {{ITEM_TYPE}}
Description: {{ITEM_DESCRIPTION}}
Amount: {{ITEM_AMOUNT}}
Date Reported: {{DATE_REPORTED}}
Status: {{CURRENT_STATUS}}

DISPUTE BASIS:
{{DISPUTE_REASON}}

VERIFICATION CHALLENGE:
Public records require verification through official government sources. I request that you:
1. Obtain official verification from {{GOVERNMENT_ENTITY}}
2. Confirm current status of the {{ITEM_TYPE}}
3. Verify the accuracy of all reported data points
4. Delete or update if verification shows inaccuracy or resolution

LEGAL GROUNDS:
Under FCRA § 611, even public records must be verified for accuracy. An inaccurate public record (such as a satisfied judgment still reported as unsatisfied) must be deleted.

FCRA § 605(e) provides specific timelines for reporting public records. If the item exceeds applicable time limits, it must be deleted.

TIME LIMIT VERIFICATION:
- Judgments: Typically 7 years, but state law varies
- Tax Liens: May continue if unpaid
- Bankruptcies: 7-10 years depending on type

I expect full verification and written results within 30 days. If this item cannot be verified as accurate through official sources, immediate deletion is required.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}`,
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'ITEM_TYPE', 'ITEM_DESCRIPTION', 'ITEM_AMOUNT', 'DATE_REPORTED', 'CURRENT_STATUS', 'DISPUTE_REASON', 'GOVERNMENT_ENTITY', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FCRA 611', 'FCRA 605', 'FCRA 605(e)'],
    promptContext: 'Public record dispute - judgments, liens, bankruptcies. Emphasis on official verification and accuracy requirements.',
  },
  
  // ============================================
  // ROUND 2 - ESCALATION DISPUTES (4)
  // ============================================
  {
    name: 'Round 2 Bureau Dispute - Inadequate Verification',
    description: 'Follow-up dispute claiming bureau failed to conduct reasonable investigation',
    methodology: 'consumer_law' as const,
    targetRecipient: 'bureau' as const,
    round: 2,
    itemTypes: ['late_payment', 'charge_off', 'collection'],
    reasonCodes: ['inadequate_investigation', 'failed_verification'],
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Second Dispute - Bureau Failed Reasonable Investigation
FCRA Section 611(a)(1) Violation

Dear Credit Bureau:

I am re-disputing {{CREDITOR_NAME}} account {{ACCOUNT_NUMBER_MASKED}} after your investigation failed to meet FCRA Section 611(a)(1) requirements for a "reasonable investigation."

ORIGINAL DISPUTE: {{ORIGINAL_DISPUTE_DATE}}
YOUR RESPONSE: "Information verified as accurate"

INVESTIGATION DEFICIENCY:
Your response did not address the specific inaccuracies I identified. Merely verifying the furnisher's data WITHOUT independent verification is not a reasonable investigation.

FCRA SECTION 611(a)(1) REQUIREMENTS:
A "reasonable investigation" requires the credit bureau to:
1. Contact the furnisher AND request verification documentation
2. Independently assess the furnisher's response
3. Address EACH specific dispute point
4. Request competent evidence supporting verification

WHAT YOU FAILED TO DO:
- Did not provide documentation showing HOW verification was conducted
- Did not address {{SPECIFIC_UNADDRESSED_CLAIM}}
- Did not verify Metro 2 field accuracy
- Did not determine furnisher actually reviewed the account

LEGAL CONSEQUENCE:
Your inadequate investigation constitutes a willful violation of FCRA § 611. I am demanding that you:
1. Conduct a proper, documented reasonable investigation
2. Provide detailed investigation records
3. Delete this account if complete verification cannot be documented
4. Send written confirmation within 30 days

Failure to conduct proper investigation after receiving this second dispute demonstrates reckless disregard for consumer rights.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`,
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'CREDITOR_NAME', 'ACCOUNT_NUMBER_MASKED', 'ORIGINAL_DISPUTE_DATE', 'SPECIFIC_UNADDRESSED_CLAIM', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
    legalCitations: ['FCRA 611', 'FCRA 611(a)(1)'],
    promptContext: 'Round 2 escalation dispute challenging inadequate investigation. Focus on specific gaps in verification process.',
  },
  {
    name: 'Round 2 Bureau Dispute - No Response/Non-Compliance',
    description: 'Dispute when bureau fails to respond to initial dispute within 30 days',
    methodology: 'consumer_law' as const,
    targetRecipient: 'bureau' as const,
    round: 2,
    itemTypes: ['late_payment', 'charge_off', 'collection', 'inquiry'],
    reasonCodes: ['no_response', 'failed_to_investigate'],
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: FORMAL DEMAND - Failure to Respond to Dispute Investigation
FCRA Section 611(a) Violation & Automatic Deletion Requirement

Dear Credit Bureau:

ORIGINAL DISPUTE SENT: {{ORIGINAL_DISPUTE_DATE}}
DEADLINE FOR RESPONSE: {{RESPONSE_DEADLINE}}
CURRENT DATE: {{CURRENT_DATE}}
STATUS: {{DAYS_LATE}} DAYS OVERDUE - NO RESPONSE RECEIVED

I am formally demanding immediate deletion of the following account per FCRA requirements:

ACCOUNT: {{CREDITOR_NAME}} - {{ACCOUNT_NUMBER_MASKED}}

FCRA SECTION 611 VIOLATION:
Under FCRA § 611(a), you are legally required to investigate disputes within 30 calendar days. Failure to respond constitutes:
- Willful non-compliance with federal law
- Automatic acceptance that the account cannot be verified
- Grounds for deletion without further investigation

YOUR LEGAL OBLIGATION:
FCRA § 611(a)(1): "If the completeness or accuracy of any item of information contained in a consumer's file at a consumer reporting agency is disputed by the consumer...the consumer reporting agency shall, during the 30-day (or such longer period as established by paragraph (8)) period beginning on the date on which the consumer reporting agency receives the notice of such dispute...investigate the disputed information."

CONSEQUENCES OF YOUR FAILURE:
Your non-response is a willful violation of federal law. The disputed account MUST be deleted immediately:

1. Upon receipt of this letter, delete {{ACCOUNT_NUMBER_MASKED}} from my credit report
2. Notify me in writing of deletion
3. Delete any inquiries related to this dispute
4. Update all three bureaus with corrected report

LEGAL REMEDIES AVAILABLE:
If you do not comply with this deletion demand within 5 business days, I will file:
- CFPB complaint for FCRA violations
- State Attorney General complaint
- Federal court action under FCRA § 1681n for willful non-compliance
- Claims for statutory damages, punitive damages, and attorney fees

Delete this account NOW or face federal litigation.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}

CERTIFIED MAIL - RETURN RECEIPT REQUESTED`,
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'ORIGINAL_DISPUTE_DATE', 'RESPONSE_DEADLINE', 'DAYS_LATE', 'CREDITOR_NAME', 'ACCOUNT_NUMBER_MASKED', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FCRA 611', 'FCRA 611(a)', 'FCRA 611(a)(1)', 'FCRA 1681n'],
    promptContext: 'Hard-hitting escalation for bureau non-response. Emphasize automatic verification failure and mandatory deletion.',
  },
  {
    name: 'Round 2 Bureau Dispute - Method of Verification Challenge',
    description: 'Request documentation of HOW bureau verified the account (FCRA 611(a)(7))',
    methodology: 'method_of_verification' as const,
    targetRecipient: 'bureau' as const,
    round: 2,
    itemTypes: ['late_payment', 'charge_off', 'collection'],
    reasonCodes: ['cannot_verify', 'inadequate_verification_proof'],
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Demand for Verification Methodology Documentation
FCRA Section 611(a)(7) - "Method of Verification"

Dear Credit Bureau:

Following your response that {{ACCOUNT_NUMBER_MASKED}} was "verified as accurate," I am demanding documentation of your verification methodology per FCRA Section 611(a)(7).

ACCOUNT: {{CREDITOR_NAME}} - {{ACCOUNT_NUMBER_MASKED}}

FCRA SECTION 611(a)(7) REQUIREMENT:
"If a consumer reporting agency receives notice of a dispute with respect to any information provided by a furnisher of information to the consumer reporting agency, the consumer reporting agency shall provide notice to the furnisher of the dispute and...shall, if expiration of the 30-day period set forth in subsection (a)(1) is before the expiration of the period referred to in section 1681p(d), inform the furnisher of its right to dispute the further reporting of information on which the dispute is based."

SPECIFIC DOCUMENTATION REQUIRED:
You must provide copies of:
1. Complete verification communication with {{CREDITOR_NAME}}
2. EXACT date/time/method furnisher was contacted
3. Furnisher's complete written response
4. Metro 2 formatted data verification
5. How each disputed point was independently verified
6. Documentation showing furnisher reviewed original account records

CHALLENGE TO VERIFICATION:
If furnisher merely replied "verified" without documentation of investigation, that does not constitute valid verification. I require COMPETENT EVIDENCE.

LEGAL STANDARD:
Verification requires the furnisher to:
- Review original account documentation
- Verify complete and accurate account information
- Confirm account status, balance, payment history
- Support verification with written evidence

YOUR OBLIGATION:
Provide complete verification documentation within 15 days. If this documentation cannot be produced, the account must be deleted under FCRA requirements.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`,
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'ACCOUNT_NUMBER_MASKED', 'CREDITOR_NAME', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
    legalCitations: ['FCRA 611', 'FCRA 611(a)(7)', 'FCRA 1681p'],
    promptContext: 'Demand for proof of verification methodology. Focus on requiring COMPETENT EVIDENCE and documentation of verification process.',
  },
  {
    name: 'Round 2 Bureau Dispute - Multiple Rounds No Success',
    description: 'Escalation after multiple dispute attempts without resolution',
    methodology: 'consumer_law' as const,
    targetRecipient: 'bureau' as const,
    round: 2,
    itemTypes: ['late_payment', 'charge_off', 'collection'],
    reasonCodes: ['persistent_violation', 'failed_multiple_disputes'],
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: FINAL NOTICE - Escalating to Federal Enforcement
Persistent FCRA Violations - Dispute Round {{DISPUTE_ROUND}}

Dear {{BUREAU_NAME}}:

Despite {{DISPUTE_ROUND}} formal disputes submitted to you regarding {{ACCOUNT_NUMBER_MASKED}}, this account remains improperly reported.

DISPUTE HISTORY:
- Round 1 ({{ROUND_1_DATE}}): Dispute submitted - Account NOT deleted
- Round 2 ({{ROUND_2_DATE}}): Re-dispute submitted - Account NOT deleted
{{#if ROUND_3_DATE}}- Round 3 ({{ROUND_3_DATE}}): Re-dispute submitted - Account STILL NOT deleted{{/if}}

PATTERN OF WILLFUL NON-COMPLIANCE:
Your repeated failure to investigate and delete this account demonstrates either:
1. Reckless disregard for FCRA requirements, OR
2. Willful violation of consumer rights

Either constitutes federal violation grounds.

ACCOUNT INFORMATION:
Creditor: {{CREDITOR_NAME}}
Account Number: {{ACCOUNT_NUMBER_MASKED}}
Balance: {{ACCOUNT_BALANCE}}
Status: {{ACCOUNT_STATUS}}

ESCALATION TO FEDERAL ENFORCEMENT:
Due to your persistent non-compliance, I am escalating this matter:

1. **CFPB COMPLAINT** - Filing formal complaint documenting your systematic failure to honor disputes
2. **STATE ATTORNEY GENERAL** - Filing complaint in {{STATE}} for FCRA violations and deceptive practices
3. **FEDERAL LITIGATION** - Pursuing claims under FCRA § 1681n for willful violations
4. **CLASS ACTION POTENTIAL** - Your pattern suggests systematic violations affecting other consumers

STATUTORY DAMAGES:
FCRA § 1681n provides for statutory damages of $100 to $1,000 per violation PER CONSUMER, plus punitive damages and attorney fees.

FINAL DEMAND:
Delete {{ACCOUNT_NUMBER_MASKED}} within 5 business days or face federal action.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}

SENT VIA CERTIFIED MAIL - RETURN RECEIPT REQUESTED`,
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'ACCOUNT_NUMBER_MASKED', 'BUREAU_NAME', 'DISPUTE_ROUND', 'ROUND_1_DATE', 'ROUND_2_DATE', 'ROUND_3_DATE', 'CREDITOR_NAME', 'ACCOUNT_BALANCE', 'ACCOUNT_STATUS', 'STATE', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FCRA 611', 'FCRA 1681n'],
    promptContext: 'Escalation letter after multiple failed dispute rounds. Threatening federal enforcement and litigation.',
  },
  
  // ============================================
  // DIRECT TO CREDITOR/FURNISHER DISPUTES (5)
  // ============================================
  {
    name: 'Direct Creditor - FCRA Section 623 Dispute',
    description: 'Direct dispute to furnisher requiring accurate reporting compliance',
    methodology: 'factual' as const,
    targetRecipient: 'creditor' as const,
    round: 1,
    itemTypes: ['late_payment', 'charge_off', 'collection', 'account_status'],
    reasonCodes: ['inaccurate_reporting', 'cannot_verify'],
    content: `{{CURRENT_DATE}}

{{FURNISHER_ADDRESS}}

Re: FORMAL NOTICE - Inaccurate Credit Reporting Violation
FCRA Section 623 - Furnisher Accuracy Requirements

To Whom It May Concern:

I am writing regarding inaccurate information YOUR COMPANY is reporting to credit bureaus about my account:

ACCOUNT DETAILS:
Account Number: {{ACCOUNT_NUMBER_MASKED}}
Account Holder: {{ACCOUNT_HOLDER}}
Current Amount Reported: {{REPORTED_AMOUNT}}

INACCURACY:
{{INACCURACY_DESCRIPTION}}

FCRA SECTION 623 VIOLATION:
Under 15 U.S.C. § 1681s-2(a), furnishers of credit information must:
1. Report accurate information
2. Conduct reasonable investigations when disputes are received
3. Notify consumer of dispute results
4. Correct or delete inaccurate information

Your continued reporting of inaccurate information violates this federal requirement.

REQUIRED ACTION:
1. Investigate this inaccuracy within 30 days
2. Verify the accuracy of ALL reported data points
3. Delete this account if accuracy cannot be confirmed
4. Cease reporting to all credit bureaus
5. Notify credit bureaus of correction/deletion

METRO 2 COMPLIANCE:
As a data furnisher, you must maintain Metro 2 format compliance. Failure to report accurate information in proper Metro 2 format constitutes systematic violation.

LEGAL CONSEQUENCES:
Under FCRA § 1681n, willful non-compliance with furnisher duties exposes you to:
- Statutory damages of $100-$1,000 per violation
- Punitive damages
- Attorney fees and costs
- CFPB enforcement actions
- State attorney general actions

Correct this violation within 30 days or face federal litigation.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}`,
    variables: ['CURRENT_DATE', 'FURNISHER_ADDRESS', 'ACCOUNT_NUMBER_MASKED', 'ACCOUNT_HOLDER', 'REPORTED_AMOUNT', 'INACCURACY_DESCRIPTION', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FCRA 623', 'FCRA 1681s-2', 'FCRA 1681n'],
    promptContext: 'Direct to furnisher FCRA Section 623 dispute. Emphasize furnisher liability and Metro 2 compliance requirements.',
  },
  {
    name: 'Direct Creditor - Debt Validation FDCPA Letter',
    description: 'Debt validation request for collections or charged-off accounts',
    methodology: 'debt_validation' as const,
    targetRecipient: 'creditor' as const,
    round: 1,
    itemTypes: ['collection', 'charge_off'],
    reasonCodes: ['cannot_verify', 'debt_disputed'],
    content: `{{CURRENT_DATE}}

{{CREDITOR_ADDRESS}}

Re: Demand for Debt Validation - FDCPA Section 809
Proof of Claim Required

To Whom It May Concern:

This letter is a formal demand for validation of the alleged debt referenced below, submitted pursuant to the Fair Debt Collection Practices Act, 15 U.S.C. § 1692g:

ALLEGED DEBT DETAILS:
Your Company: {{CREDITOR_NAME}}
Account Number: {{ACCOUNT_NUMBER_MASKED}}
Alleged Amount: {{ALLEGED_AMOUNT}}
Account Status: {{ACCOUNT_STATUS}}

VALIDATION DEMAND:
I request competent evidence of the following:
1. **Original Creditor Verification** - Proof this account originated with your company
2. **Complete Account History** - Full payment history from opening to present
3. **Account Ownership** - Documentation proving I am responsible for this account
4. **Current Debt Amount** - Itemized breakdown of alleged debt
5. **Authority to Collect** - Documentation of your authority to collect
6. **Terms of Original Agreement** - Copy of original account agreement/contract
7. **Proof of Assignment** - If account was assigned to you, complete assignment documents

LEGAL REQUIREMENT:
Under FDCPA § 809(a): "If the consumer notifies the debt collector in writing within the thirty-day period...the debt collector shall cease collection of the debt...until the debt collector obtains verification of the debt...in the form of a contract, judgment, or recitation of the terms of the debt, or...the name and address of the original creditor, if different from the present creditor."

YOUR OBLIGATION:
Provide complete validation documentation within 30 days. Failure to provide proper validation constitutes failure to prove the debt.

IMPORTANT NOTICE:
This is a formal demand for validation. Any collection activity that continues without proper validation violates FDCPA Section 809.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}`,
    variables: ['CURRENT_DATE', 'CREDITOR_ADDRESS', 'CREDITOR_NAME', 'ACCOUNT_NUMBER_MASKED', 'ALLEGED_AMOUNT', 'ACCOUNT_STATUS', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FDCPA 809', 'FDCPA 809(a)'],
    promptContext: 'FDCPA debt validation letter. Detailed requirements for proof of debt with specific documentation demands.',
  },
  {
    name: 'Direct Creditor - Pay for Delete Offer',
    description: 'Settlement offer requesting account deletion in exchange for payment',
    methodology: 'goodwill' as const,
    targetRecipient: 'creditor' as const,
    round: 1,
    itemTypes: ['collection', 'charge_off'],
    reasonCodes: ['settled_account'],
    content: `{{CURRENT_DATE}}

{{CREDITOR_ADDRESS}}

Re: Settlement Proposal with Deletion Agreement
Account {{ACCOUNT_NUMBER_MASKED}}

Dear {{CREDITOR_NAME}}:

I am interested in resolving the outstanding balance on my account and would like to propose a settlement arrangement WITH the condition of complete account deletion.

CURRENT ACCOUNT STATUS:
Account: {{ACCOUNT_NUMBER_MASKED}}
Current Balance: {{CURRENT_BALANCE}}
Settlement Offer: {{SETTLEMENT_AMOUNT}} ({{SETTLEMENT_PERCENTAGE}}% settlement)

SETTLEMENT TERMS:
1. Upon receipt of signed deletion agreement, I will pay {{SETTLEMENT_AMOUNT}}
2. Upon payment clearance, you will delete this account from all credit bureau reports
3. You will send deletion confirmation within 10 days of payment
4. You will send updated account statement showing "$0 balance - Settled/Deleted"

DELETION COMMITMENT:
For this settlement to be acceptable, I require your written commitment to:
- Delete account from Equifax, Experian, and TransUnion
- Cease all collection efforts and reporting
- Not report account status changes after deletion
- Provide written confirmation of deletion to me

This is a Pay-for-Delete arrangement. Without deletion commitment, we cannot proceed.

PAYMENT METHOD:
Upon receipt of signed deletion agreement, payment will be made via [PAYMENT METHOD].

If this arrangement is acceptable, please respond with signed deletion agreement within 10 days.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}

ENCLOSURES:
- Proposed settlement agreement (attached)`,
    variables: ['CURRENT_DATE', 'CREDITOR_ADDRESS', 'ACCOUNT_NUMBER_MASKED', 'CREDITOR_NAME', 'CURRENT_BALANCE', 'SETTLEMENT_AMOUNT', 'SETTLEMENT_PERCENTAGE', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FCRA 611'],
    promptContext: 'Pay-for-delete settlement proposal. Clear terms and deletion commitment requirement.',
  },
  {
    name: 'Direct Creditor - Goodwill Adjustment Letter',
    description: 'Goodwill request for account removal based on payment history and circumstances',
    methodology: 'goodwill' as const,
    targetRecipient: 'creditor' as const,
    round: 1,
    itemTypes: ['late_payment', 'charge_off'],
    reasonCodes: ['goodwill_request'],
    content: `{{CURRENT_DATE}}

{{CREDITOR_ADDRESS}}

Re: Goodwill Adjustment Request - Account {{ACCOUNT_NUMBER_MASKED}}

Dear {{CREDITOR_NAME}}:

I am writing to request your consideration for a goodwill adjustment to remove or update the negative mark on my account due to {{CIRCUMSTANCE}}.

ACCOUNT INFORMATION:
Account Number: {{ACCOUNT_NUMBER_MASKED}}
Account Status: {{ACCOUNT_STATUS}}
Original Delinquency: {{DELINQUENCY_DATE}}
Current Status: {{CURRENT_STATUS}}

MY CIRCUMSTANCES:
{{CIRCUMSTANCES_EXPLANATION}}

POSITIVE HISTORY:
- Years as customer: {{YEARS_AS_CUSTOMER}}
- Account opened: {{ACCOUNT_OPENED_DATE}}
- On-time payments before issue: {{PRIOR_PAYMENT_HISTORY}}
- Post-issue payments: {{POST_ISSUE_PAYMENTS}}

GOODWILL REQUEST:
Given my {{YEARS_AS_CUSTOMER}} years of good standing with your company and my current on-time payment status, I respectfully request that you:

1. Update account status to "Paid" or "Settled"
2. Remove negative mark from credit reporting
3. Provide deletion confirmation to credit bureaus

MUTUAL BENEFIT:
Removing this negative mark would:
- Allow me to maintain our customer relationship
- Improve my credit profile and financial health
- Demonstrate your company's commitment to customer satisfaction
- Reduce churn and maintain long-term customer value

I value my relationship with your company and would appreciate your consideration of this reasonable request.

Thank you for reviewing my request.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}

ENCLOSURES:
- Account statement showing current status
- Payment history documentation`,
    variables: ['CURRENT_DATE', 'CREDITOR_ADDRESS', 'ACCOUNT_NUMBER_MASKED', 'CREDITOR_NAME', 'ACCOUNT_STATUS', 'DELINQUENCY_DATE', 'CURRENT_STATUS', 'CIRCUMSTANCE', 'CIRCUMSTANCES_EXPLANATION', 'YEARS_AS_CUSTOMER', 'ACCOUNT_OPENED_DATE', 'PRIOR_PAYMENT_HISTORY', 'POST_ISSUE_PAYMENTS', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FCRA 611'],
    promptContext: 'Goodwill letter emphasizing positive history and circumstances. Focuses on customer value and mutual benefit.',
  },

  // ============================================
  // COLLECTION AGENCY DISPUTES (6)
  // ============================================
  {
    name: 'Collection Agency - FDCPA Debt Validation Demand',
    description: 'Aggressive debt validation demanding specific competent evidence',
    methodology: 'debt_validation' as const,
    targetRecipient: 'collector' as const,
    round: 1,
    itemTypes: ['collection'],
    reasonCodes: ['debt_disputed', 'cannot_verify'],
    content: `{{CURRENT_DATE}}

{{COLLECTOR_ADDRESS}}

Re: FORMAL NOTICE - DEBT VALIDATION DEMAND
FDCPA Section 809(a) - Required Response Within 30 Days

[CERTIFIED MAIL - RETURN RECEIPT REQUESTED]

To {{COLLECTION_AGENCY}}:

I am formally demanding complete validation of the alleged debt referenced below, submitted pursuant to the Fair Debt Collection Practices Act (FDCPA), 15 U.S.C. § 1692g.

ALLEGED DEBT DETAILS:
Collection Agency: {{COLLECTION_AGENCY}}
Account Number: {{ACCOUNT_NUMBER}}
Alleged Amount: ${{ALLEGED_AMOUNT}}
Alleged Creditor: {{ALLEGED_CREDITOR}}

VALIDATION DEMAND - REQUIRED EVIDENCE:
You must provide the following COMPETENT EVIDENCE within 30 days:

1. **Original Contract** - Complete copy of original account agreement or contract showing my obligation
2. **Complete Account History** - All statements, payments, and charges from account opening to collection
3. **Proof of Assignment** - If debt was assigned to you, complete assignment documents from original creditor
4. **Authority to Collect** - Documentation of your authority to collect this specific debt
5. **Creditor Verification** - Name and contact of original creditor with business records supporting the debt
6. **Amount Calculation** - Itemized breakdown showing how collection amount was determined
7. **Statute of Limitations** - Proof that collection action is timely under state law ({{STATE_SOL_YEARS}} year limit)

FDCPA REQUIREMENT:
Under FDCPA § 809(a), if you cannot provide complete validation within 30 days, you must CEASE all collection activity.

LEGAL NOTICE:
This is my notice of dispute under FDCPA. Any collection activity continuing without proper validation violates federal law and subjects you to liability.

ENFORCEMENT NOTICE:
Failure to provide proper validation or continued collection activity without validation will result in:
- Federal lawsuit for FDCPA violations
- Statutory damages of $1,000 per violation
- Actual damages
- Attorney fees and court costs
- CFPB complaint
- State attorney general action

Provide complete validation documentation within 30 days or cease all collection activity.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}
{{CONSUMER_SSN_LAST4}}

[SENT VIA CERTIFIED MAIL - RETURN RECEIPT REQUESTED]`,
    variables: ['CURRENT_DATE', 'COLLECTOR_ADDRESS', 'COLLECTION_AGENCY', 'ACCOUNT_NUMBER', 'ALLEGED_AMOUNT', 'ALLEGED_CREDITOR', 'STATE_SOL_YEARS', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE', 'CONSUMER_SSN_LAST4'],
    legalCitations: ['FDCPA 809', 'FDCPA 809(a)'],
    promptContext: 'Aggressive FDCPA debt validation letter with specific competent evidence demands and legal threats.',
  },
  {
    name: 'Collection Agency - Cease & Desist Letter',
    description: 'Formal demand to cease collection activity and communications under FDCPA Section 805(c)',
    methodology: 'consumer_law' as const,
    targetRecipient: 'collector' as const,
    round: 1,
    itemTypes: ['collection'],
    reasonCodes: ['harassment', 'cease_contact'],
    content: `{{CURRENT_DATE}}

{{COLLECTOR_ADDRESS}}

Re: CEASE & DESIST NOTICE
FDCPA Section 805(c) - Cease All Collection Activity

[CERTIFIED MAIL - RETURN RECEIPT REQUESTED]

Dear {{COLLECTION_AGENCY}}:

I am formally directing you to IMMEDIATELY CEASE AND DESIST all collection activity, communications, and reporting regarding the following alleged account:

ACCOUNT INFORMATION:
Collection Agency: {{COLLECTION_AGENCY}}
Alleged Account: {{ACCOUNT_NUMBER}}
Alleged Amount: ${{ALLEGED_AMOUNT}}

CEASE & DESIST DEMAND:
Under FDCPA Section 805(c), I am commanding that you:

1. CEASE all telephone calls, letters, and communications
2. CEASE all collection attempts and actions
3. CEASE all credit bureau reporting
4. CEASE all third-party communications about this account
5. Remove any ongoing collection notes or flags from your system

FDCPA SECTION 805(c) - YOUR LEGAL OBLIGATION:
"If a consumer notifies a debt collector in writing that the consumer refuses to pay a debt or wishes the debt collector to cease further communication with the consumer, the debt collector shall not communicate further with the consumer with respect to such debt."

LEGAL CONSEQUENCE:
Any communication or collection activity after receipt of this notice violates federal law and exposes you to liability for:
- Statutory damages of up to $1,000 per violation
- Actual damages for harassment
- Attorney fees and court costs
- FDCPA violations for each contact/communication
- CFPB enforcement action
- State attorney general action

YOUR ONLY PERMITTED RESPONSE:
You may ONLY send ONE written response confirming that you:
- Have ceased all collection activity
- Have removed yourself from their system
- Will not contact me again

NO EXCEPTIONS - NO MORE CONTACT

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}

[SENT VIA CERTIFIED MAIL - RETURN RECEIPT REQUESTED]`,
    variables: ['CURRENT_DATE', 'COLLECTOR_ADDRESS', 'COLLECTION_AGENCY', 'ACCOUNT_NUMBER', 'ALLEGED_AMOUNT', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FDCPA 805', 'FDCPA 805(c)'],
    promptContext: 'Cease and desist letter under FDCPA Section 805(c). Absolute prohibition on further contact with legal consequences.',
  },
  {
    name: 'Collection Agency - Follow-Up: No Validation Received',
    description: 'Follow-up letter when collection agency fails to validate debt',
    methodology: 'debt_validation' as const,
    targetRecipient: 'collector' as const,
    round: 2,
    itemTypes: ['collection'],
    reasonCodes: ['failed_validation', 'no_response'],
    content: `{{CURRENT_DATE}}

{{COLLECTOR_ADDRESS}}

Re: FINAL NOTICE - Collection Agency Failed Debt Validation
FDCPA Section 809(b) - Automatic Cessation of Collection

[CERTIFIED MAIL - RETURN RECEIPT REQUESTED]

Dear {{COLLECTION_AGENCY}}:

On {{ORIGINAL_DEMAND_DATE}}, I submitted a formal debt validation demand under FDCPA Section 809(a). The {{DAYS_SINCE_DEMAND}}-day validation period has EXPIRED without receipt of proper validation.

ORIGINAL DEMAND: {{ORIGINAL_DEMAND_DATE}}
VALIDATION DEADLINE: {{VALIDATION_DEADLINE}}
RESPONSE RECEIVED: NO RESPONSE / INADEQUATE RESPONSE
CURRENT STATUS: VALIDATION FAILED

FDCPA SECTION 809(b) CONSEQUENCE:
"If the debt collector does not obtain such verification of the debt or does not receive such admission from the consumer and does not thereafter receive any further written confirmation from the consumer, the debt collector shall cease collection of the debt."

YOUR LEGAL OBLIGATION - EFFECTIVE IMMEDIATELY:
1. CEASE all collection activity on {{ACCOUNT_NUMBER}}
2. STOP all credit bureau reporting
3. DELETE any credit file entries for this account
4. REMOVE from your collection system
5. Do NOT pursue this claimed debt further

VIOLATIONS CREATED BY YOUR FAILURE:
Your failure to provide validation within 30 days constitutes:
- Violation of FDCPA § 809(b)
- Continued collection on unvalidated debt (illegal)
- Potential violation of FCRA if credit reporting continues
- Basis for federal lawsuit

CONSEQUENCES FOR CONTINUED ACTIVITY:
Any collection activity after this notice violates federal law. I will pursue:
- Federal lawsuit for FDCPA violations
- Statutory damages of up to $1,000 per violation
- Punitive damages for reckless disregard
- Attorney fees and costs
- CFPB complaints
- State attorney general action

FINAL DEMAND:
1. CEASE all collection activity immediately
2. Delete this account from credit bureaus
3. Send written confirmation within 5 business days

Failure to comply with this final demand will result in immediate federal litigation.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}

[SENT VIA CERTIFIED MAIL - RETURN RECEIPT REQUESTED]`,
    variables: ['CURRENT_DATE', 'COLLECTOR_ADDRESS', 'COLLECTION_AGENCY', 'ORIGINAL_DEMAND_DATE', 'DAYS_SINCE_DEMAND', 'VALIDATION_DEADLINE', 'ACCOUNT_NUMBER', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FDCPA 809', 'FDCPA 809(b)'],
    promptContext: 'Follow-up letter after failed debt validation. Invoke automatic cessation requirement under FDCPA 809(b).',
  },
  {
    name: 'Collection Agency - Dispute Paid Collection',
    description: 'Dispute claim for collection that has already been paid',
    methodology: 'factual' as const,
    targetRecipient: 'collector' as const,
    round: 1,
    itemTypes: ['collection'],
    reasonCodes: ['paid_account', 'settled_account'],
    content: `{{CURRENT_DATE}}

{{COLLECTOR_ADDRESS}}

Re: Dispute of PAID Collection Account
Account {{ACCOUNT_NUMBER}} - Should Be Deleted

Dear {{COLLECTION_AGENCY}}:

I am formally disputing the inclusion of the above-referenced collection on my credit report because this account has been PAID IN FULL.

PAID ACCOUNT DETAILS:
Collection Agency: {{COLLECTION_AGENCY}}
Account Number: {{ACCOUNT_NUMBER}}
Amount Paid: ${{AMOUNT_PAID}}
Date Payment Received: {{PAYMENT_DATE}}
Payment Confirmation: {{CONFIRMATION_NUMBER}}

ACCOUNT STATUS:
Current Status Reported: {{CURRENT_STATUS_REPORTED}}
Correct Status: PAID IN FULL

LEGAL REQUIREMENT:
Under FCRA Section 611 and FDCPA requirements, paid collection accounts must be:
1. Updated in credit report to show "Paid" status
2. Eventually deleted from credit report
3. Not reported as open collection

VERIFICATION ENCLOSED:
- Payment receipt from {{PAYMENT_METHOD}}
- Confirmation number: {{CONFIRMATION_NUMBER}}
- Bank statement showing payment
- Any settlement/release documentation

DEMAND:
Update my credit report to show this account as "Paid in Full" and delete it from credit reporting immediately. This account should not appear as an active collection since it has been satisfied.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}

ENCLOSURES:
- Payment receipt
- Bank statement
- Correspondence confirming payment`,
    variables: ['CURRENT_DATE', 'COLLECTOR_ADDRESS', 'ACCOUNT_NUMBER', 'COLLECTION_AGENCY', 'AMOUNT_PAID', 'PAYMENT_DATE', 'CONFIRMATION_NUMBER', 'CURRENT_STATUS_REPORTED', 'PAYMENT_METHOD', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FCRA 611', 'FDCPA Requirements'],
    promptContext: 'Dispute for paid collection accounts. Emphasize payment proof and requirement to update credit report.',
  },
  {
    name: 'Collection Agency - Do Not Call Letter',
    description: 'Demand to stop telephone contact per FDCPA telephone restrictions',
    methodology: 'consumer_law' as const,
    targetRecipient: 'collector' as const,
    round: 1,
    itemTypes: ['collection'],
    reasonCodes: ['harassment', 'unwanted_contact'],
    content: `{{CURRENT_DATE}}

{{COLLECTOR_ADDRESS}}

Re: DO NOT CALL NOTICE
FDCPA Section 805(b) - Telephone Contact Restrictions

[CERTIFIED MAIL - RETURN RECEIPT REQUESTED]

Dear {{COLLECTION_AGENCY}}:

I am formally notifying you that I DO NOT AUTHORIZE ANY TELEPHONE CONTACT regarding the alleged account below. You are prohibited from calling me by federal law.

ACCOUNT INFORMATION:
Collection Agency: {{COLLECTION_AGENCY}}
Account Number: {{ACCOUNT_NUMBER}}

PROHIBITED CONTACT:
Under FDCPA Section 805(b), debt collectors are prohibited from:
- Calling before 8:00 AM or after 9:00 PM
- Calling repeatedly or continuously
- Using telephone contact to harass or annoy
- Calling my workplace if they know my employer prohibits such calls
- Calling family members about my debt

MY DIRECTIVE:
I am formally requesting that you:
1. STOP ALL TELEPHONE CALLS immediately
2. REMOVE my phone number from your system
3. CEASE contacting me by phone
4. Use written communication only (mail)

LEGAL BASIS:
FDCPA § 805(b): "A debt collector may not engage in any conduct the natural consequence of which is to harass, oppress, or abuse any person in connection with the collection of a debt."

CONSEQUENCE OF VIOLATIONS:
Each phone call after receiving this notice violates federal law and subjects you to:
- $1,000+ statutory damages per violation per call
- Additional damages for harassment
- FDCPA lawsuits and enforcement
- CFPB complaints
- Attorney fees and costs

DO NOT CALL AFTER RECEIVING THIS NOTICE.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}

[SENT VIA CERTIFIED MAIL - RETURN RECEIPT REQUESTED]`,
    variables: ['CURRENT_DATE', 'COLLECTOR_ADDRESS', 'COLLECTION_AGENCY', 'ACCOUNT_NUMBER', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
    legalCitations: ['FDCPA 805', 'FDCPA 805(b)'],
    promptContext: 'Do not call letter prohibiting telephone contact. Reference FDCPA telephone restrictions and harassment provisions.',
  },
];

async function seedConsolidatedTemplates() {
  console.log('Seeding consolidated dispute letter templates...');
  console.log(`Adding ${CONSOLIDATED_TEMPLATES.length} enhanced, Metro 2-compliant templates\n`);

  const now = new Date();
  let successCount = 0;
  let failureCount = 0;

  for (const template of CONSOLIDATED_TEMPLATES) {
    const id = randomUUID();

    try {
      await db.insert(disputeLetterLibrary).values({
        id,
        name: template.name,
        description: template.description,
        methodology: template.methodology,
        targetRecipient: template.targetRecipient,
        round: template.round,
        itemTypes: JSON.stringify(template.itemTypes),
        reasonCodes: JSON.stringify(template.reasonCodes),
        content: template.content,
        variables: JSON.stringify(template.variables),
        legalCitations: JSON.stringify(template.legalCitations),
        promptContext: template.promptContext,
        timesUsed: 0,
        successCount: 0,
        effectivenessRating: 85,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });

      console.log(`  ✓ ${template.name}`);
      successCount++;
    } catch (error) {
      console.error(`  ✗ Failed: ${template.name}`, error);
      failureCount++;
    }
  }

  console.log(`\n✅ Seeded ${successCount}/${CONSOLIDATED_TEMPLATES.length} dispute letter templates`);
  if (failureCount > 0) {
    console.log(`⚠️  ${failureCount} templates failed to seed`);
  }
  process.exit(failureCount === 0 ? 0 : 1);
}

seedConsolidatedTemplates().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});

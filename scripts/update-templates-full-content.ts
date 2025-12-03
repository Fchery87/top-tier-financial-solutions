import 'dotenv/config';
import { db } from '../db/client';
import { disputeLetterTemplates } from '../db/schema';
import { eq } from 'drizzle-orm';

const TEMPLATE_UPDATES = [
  {
    name: 'Round 1 - Standard Inaccuracy Dispute',
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Dispute of Inaccurate Information - Account {{ACCOUNT_LAST4}}
FCRA Section 611 Investigation Request

Dear Credit Bureau,

I am formally disputing inaccurate information on my credit report pursuant to 15 U.S.C. Section 1681i(a). 

ACCOUNT INFORMATION:
Creditor: {{CREDITOR_NAME}}
Account Number: {{ACCOUNT_MASKED}}
Current Status: {{REPORTED_STATUS}}

SPECIFIC INACCURACY:
{{DISPUTE_REASON}}

LEGAL STANDARD:
Under FCRA § 611, you must conduct a reasonable investigation within 30 days. This requires:
1. Contacting the furnisher for verification
2. Requesting competent evidence supporting the account
3. Verifying complete accuracy of all Metro 2 data fields
4. Deleting information that cannot be verified as completely accurate

METRO 2 COMPLIANCE REQUIREMENT:
As a major consumer reporting agency, you must ensure furnishers report data in proper Metro 2 format. Failure to verify Metro 2 compliance constitutes willful non-compliance with FCRA § 1681n standards.

REQUIRED ACTION:
Delete this account if verification cannot be completed, or provide detailed written documentation of your investigation methodology.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}`
  },
  {
    name: 'Round 1 - Not My Account Dispute',
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Account Does Not Belong to Me - {{ACCOUNT_LAST4}}

Dear Credit Bureau,

I dispute the following account appearing on my credit report as it does NOT belong to me:

DISPUTED ACCOUNT:
Creditor: {{CREDITOR_NAME}}
Account Number: {{ACCOUNT_MASKED}}
Amount: {{AMOUNT}}

REASON FOR DISPUTE:
I have never opened an account with this creditor and have no knowledge of this obligation. This represents either a mixed file error or identity theft.

REQUIRED VERIFICATION:
I demand that you:
1. Verify that I actually opened this account
2. Obtain documentation linking this account to me (contract, application, etc.)
3. Delete the account if ownership cannot be verified
4. Provide written confirmation of deletion

Under FCRA § 611, if the creditor cannot verify account ownership, this must be deleted.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}`
  },
  {
    name: 'Round 1 - Duplicate Account Dispute',
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Dispute of Duplicate Account Entry - {{ACCOUNT_LAST4}}

Dear Credit Bureau,

I dispute duplicate entries for the same account appearing on my credit report:

DUPLICATE ENTRIES:
Entry 1: {{CREDITOR_1}} - {{ACCOUNT_1}}
Entry 2: {{CREDITOR_2}} - {{ACCOUNT_2}}

These are the SAME account appearing twice. This artificially inflates my reported indebtedness and violates FCRA accuracy standards.

REQUIRED ACTION:
1. Verify these are duplicates
2. Delete the duplicate entry
3. Provide written confirmation

Duplicate reporting violates FCRA Section 611 accuracy requirements.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`
  },
  {
    name: 'Round 1 - Obsolete Account (7+ Years)',
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Demand for Removal - Account Exceeds 7-Year Reporting Period
FCRA Section 605(b) Violation

Dear Credit Bureau,

I demand immediate deletion of the following account which has exceeded the 7-year reporting period under FCRA Section 605(b):

ACCOUNT INFORMATION:
Creditor: {{CREDITOR_NAME}}
Original Delinquency Date: {{ORIGINAL_DELINQ_DATE}}
7-Year Expiration Date: {{EXPIRATION_DATE}}
Current Date: {{CURRENT_DATE}}
STATUS: ACCOUNT IS {{DAYS_PAST}} DAYS PAST THE LEGAL LIMIT

LEGAL REQUIREMENT:
FCRA § 605(b) prohibits credit bureaus from reporting most negative items more than 7 years from the original date of delinquency. This account exceeded that limit on {{EXPIRATION_DATE}}.

Continued reporting of this obsolete item is a direct violation of federal law.

MANDATORY ACTION:
Delete this account immediately or face FCRA violation claims and CFPB complaints.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`
  },
  {
    name: 'Round 1 - Medical Debt Dispute',
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Dispute of Medical Collection Account - {{ACCOUNT_LAST4}}

Dear Credit Bureau,

I dispute the following medical collection account which may not be accurately reported:

ACCOUNT DETAILS:
Medical Provider: {{PROVIDER_NAME}}
Collection Agency: {{COLLECTION_AGENCY}}
Amount: {{AMOUNT}}

MEDICAL DEBT PROTECTIONS:
Recent regulatory changes provide enhanced protections for medical debt. Medical accounts often have payment plan arrangements or insurance dispute resolutions that are not reflected in collection reports.

VERIFICATION REQUIRED:
I demand verification that:
1. This debt legitimately transferred to the collection agency
2. All insurance claims were properly resolved
3. Proper notice was given before collection action
4. All documented payment arrangements are accurately reflected

If complete verification cannot be provided, this account must be deleted.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`
  },
  {
    name: 'Round 1 - Unauthorized Inquiry Dispute',
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Dispute of Unauthorized Hard Inquiry
FCRA Section 1681s-3(b) Violation

Dear Credit Bureau,

I dispute the following hard inquiry which was made without my authorization or legitimate permissible purpose:

INQUIRY DETAILS:
Company: {{INQUIRY_COMPANY}}
Date: {{INQUIRY_DATE}}

VIOLATION:
FCRA § 1681s-3(b) strictly prohibits furnishing credit reports without permissible purpose. I did NOT authorize {{INQUIRY_COMPANY}} to access my credit report.

REQUIRED ACTION:
1. Delete this unauthorized inquiry
2. Contact {{INQUIRY_COMPANY}} to verify permissible purpose
3. Delete if no permissible purpose can be documented
4. Provide written confirmation

Unauthorized inquiries damage credit scores and violate consumer privacy rights.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`
  },
  {
    name: 'Round 1 - Charge-Off Account Metro 2 Dispute',
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Dispute of Charge-Off Account - Metro 2 Format Violations
FCRA Section 611 & Metro 2 Compliance

Dear Credit Bureau,

I dispute the following charge-off account for Metro 2 format compliance violations:

ACCOUNT: {{CREDITOR_NAME}} - {{ACCOUNT_MASKED}}
Charge-Off Amount: {{AMOUNT}}
Reported Status Code: {{STATUS_CODE}}

METRO 2 VIOLATIONS:
Under Metro 2 format standards, this account requires verification of:
1. Account Status Code - Must be verified and accurate
2. Complete Payment History - From opening to charge-off
3. Balance Amounts - Reconciliation of reported amounts
4. Date Fields - Verification of all date fields

{{SPECIFIC_VIOLATION}}

REQUIREMENT:
Metro 2-formatted data must be completely accurate and verifiable. Furnishers must provide documentation of investigation and verification.

If complete Metro 2 verification cannot be documented, this account must be deleted per FCRA § 1681n requirements.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`
  },
  {
    name: 'Round 1 - Public Record Dispute',
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Dispute of Public Record Item - {{ITEM_TYPE}}

Dear Credit Bureau,

I dispute the following public record item:

ITEM DETAILS:
Type: {{ITEM_TYPE}}
Description: {{DESCRIPTION}}
Status: {{CURRENT_STATUS}}

VERIFICATION REQUIREMENT:
Public records must be verified through official government sources. I request that you:
1. Obtain official verification from {{GOVERNMENT_ENTITY}}
2. Confirm current status of the {{ITEM_TYPE}}
3. Delete or update if inaccurate
4. Delete if past applicable time limits

LEGAL BASIS:
FCRA § 611 requires verification even for public records. FCRA § 605(e) establishes reporting time limits.

Provide verification documentation or delete this item.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`
  },
  {
    name: 'Round 2 - Bureau No Response Violation',
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: FORMAL DEMAND - Bureau Failed to Respond to Dispute
FCRA Section 611(a) Violation

Dear Credit Bureau,

I submitted a dispute on {{DISPUTE_DATE}} regarding {{ACCOUNT_MASKED}}. You were required to respond within 30 days per FCRA § 611(a).

TIMELINE:
Dispute Sent: {{DISPUTE_DATE}}
Response Deadline: {{DEADLINE}}
Days Overdue: {{DAYS_OVERDUE}}
Response Status: NO RESPONSE RECEIVED

YOUR LEGAL OBLIGATION:
FCRA § 611(a) REQUIRES investigation within 30 days. Your failure to respond is willful non-compliance with federal law.

CONSEQUENCE:
The account cannot be verified and MUST be deleted. Non-response constitutes automatic failure of verification.

DEMAND:
Delete {{ACCOUNT_MASKED}} immediately and provide written confirmation within 5 business days or face FCRA § 1681n federal violation claims.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`
  },
  {
    name: 'Round 2 - Method of Verification Challenge',
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: Demand for Verification Methodology Documentation
FCRA Section 611(a)(7) - Method of Verification

Dear Credit Bureau,

I am demanding documentation of your verification methodology for account {{ACCOUNT_MASKED}}, which you claimed was "verified as accurate."

REQUIRED DOCUMENTATION:
You must provide:
1. Complete verification communication with {{CREDITOR_NAME}}
2. Date/time/method furnisher was contacted  
3. Furnisher's complete written response
4. Evidence that furnisher reviewed original account records
5. Documentation supporting each disputed point

LEGAL STANDARD:
Verification requires competent evidence, not simply furnisher acknowledgment. I demand documentary proof.

If this documentation cannot be provided within 15 days, the account must be deleted.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`
  },
  {
    name: 'Round 2 - Multiple Disputes No Success',
    content: `{{CURRENT_DATE}}

{{BUREAU_ADDRESS}}

Re: FINAL NOTICE - Escalating to Federal Enforcement
Persistent FCRA Violations - {{BUREAU_NAME}}

Dear {{BUREAU_NAME}},

Despite {{DISPUTE_COUNT}} formal disputes regarding {{ACCOUNT_MASKED}}, this account remains improperly reported. This pattern demonstrates willful non-compliance with federal law.

DISPUTE HISTORY:
Round 1 ({{ROUND1_DATE}}): Dispute submitted - NOT deleted
Round 2 ({{ROUND2_DATE}}): Re-dispute submitted - NOT deleted
{{#if ROUND3_DATE}}Round 3 ({{ROUND3_DATE}}): Re-dispute submitted - STILL NOT deleted{{/if}}

ESCALATION:
Your systematic failure to honor disputes is now being escalated to:
1. CFPB (Consumer Financial Protection Bureau)
2. {{STATE}} Attorney General
3. Federal litigation under FCRA § 1681n for willful violations

FINAL DEMAND:
Delete {{ACCOUNT_MASKED}} within 5 business days or face federal enforcement action.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`
  },
  {
    name: 'Direct Creditor - FCRA Section 623 Violation Notice',
    content: `{{CURRENT_DATE}}

{{FURNISHER_ADDRESS}}

Re: FORMAL NOTICE - Inaccurate Credit Reporting Violation
FCRA Section 623 - Furnisher Accuracy Requirements

To Whom It May Concern,

Your company is reporting inaccurate information about my account to credit bureaus in violation of FCRA Section 623:

ACCOUNT: {{CREDITOR_NAME}} - {{ACCOUNT_MASKED}}

INACCURACY:
{{INACCURACY_DETAILS}}

FURNISHER OBLIGATION:
Under FCRA § 1681s-2(a), you must:
1. Report only accurate information
2. Investigate disputes within 30 days
3. Correct or delete inaccurate information
4. Notify credit bureaus of corrections

Your continued reporting of inaccurate information violates federal law.

REQUIRED ACTION:
1. Investigate and correct this inaccuracy
2. Notify credit bureaus of correction/deletion
3. Provide written confirmation within 30 days

Willful violations expose you to statutory damages of $100-$1,000 per violation under FCRA § 1681n.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`
  },
  {
    name: 'Direct Creditor - FDCPA Debt Validation Request',
    content: `{{CURRENT_DATE}}

{{CREDITOR_ADDRESS}}

Re: FORMAL DEMAND - Debt Validation Required
FDCPA Section 809(a) - Proof of Claim

To Whom It May Concern,

This letter is a formal demand for validation of the alleged debt per FDCPA 15 U.S.C. § 1692g:

ALLEGED DEBT:
Creditor: {{CREDITOR_NAME}}
Account: {{ACCOUNT_NUMBER}}
Amount: {{AMOUNT}}

VALIDATION REQUIRED:
Provide competent evidence of:
1. Original account agreement/contract
2. Complete account history and statements
3. Proof of assignment (if applicable)
4. Current balance calculation
5. Authority to collect
6. Proof I am responsible for this debt

LEGAL REQUIREMENT:
FDCPA § 809(a) requires you provide validation within 30 days. Failure means the debt is unvalidated.

If validation is not provided, all collection activity must cease per FDCPA § 809(b).

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`
  },
  {
    name: 'Direct Creditor - Pay-for-Delete Settlement Proposal',
    content: `{{CURRENT_DATE}}

{{CREDITOR_ADDRESS}}

Re: Settlement Proposal with Deletion - Account {{ACCOUNT_MASKED}}

Dear {{CREDITOR_NAME}},

I propose to settle the outstanding balance on this account with the condition of complete deletion from credit reports:

SETTLEMENT TERMS:
Current Balance: {{BALANCE}}
Settlement Amount: {{SETTLEMENT_AMT}} ({{PERCENTAGE}}%)
Payment: Upon receipt of signed deletion agreement

DELETION REQUIREMENT:
I will only pay if you commit to:
- Delete from Equifax, Experian, TransUnion
- Cease all collection activity
- Provide written deletion confirmation
- Not report any status changes post-deletion

This is a Pay-for-Delete arrangement. Without deletion commitment, settlement is not acceptable.

Please respond within 10 days with signed agreement.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`
  },
  {
    name: 'Direct Creditor - Goodwill Removal Request',
    content: `{{CURRENT_DATE}}

{{CREDITOR_ADDRESS}}

Re: Goodwill Adjustment Request - Account {{ACCOUNT_MASKED}}

Dear {{CREDITOR_NAME}},

I request your consideration for a goodwill adjustment to remove or update the negative mark on my account due to {{CIRCUMSTANCE}}.

POSITIVE ACCOUNT HISTORY:
- Account since: {{ACCOUNT_OPENED}}
- Years of good standing: {{YEARS}}
- Pre-issue payment history: {{PAYMENT_HISTORY}}
- Current status: {{CURRENT_STATUS}}

CIRCUMSTANCES:
{{CIRCUMSTANCES_EXPLANATION}}

GOODWILL REQUEST:
Please remove or update this negative reporting as a goodwill gesture. This would:
- Maintain our customer relationship
- Demonstrate customer-focused policies
- Help me improve my credit profile

I value our relationship and would appreciate your consideration.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`
  },
  {
    name: 'Collection Agency - FDCPA Debt Validation (Aggressive)',
    content: `[CERTIFIED MAIL - RETURN RECEIPT REQUESTED]

{{CURRENT_DATE}}

{{COLLECTOR_ADDRESS}}

Re: FORMAL DEMAND - Complete Debt Validation Required
FDCPA Section 809(a) - 30-Day Response Required

To {{COLLECTION_AGENCY}},

DEBT VALIDATION DEMAND:
Collection Agency: {{COLLECTOR_NAME}}
Account: {{ACCOUNT_NUMBER}}
Alleged Amount: {{AMOUNT}}
Alleged Creditor: {{ORIGINAL_CREDITOR}}

COMPETENT EVIDENCE REQUIRED:
Within 30 days, provide:
1. Original contract/agreement
2. Complete payment history from account opening
3. Assignment documentation (if applicable)
4. Proof of authority to collect
5. Current balance calculation
6. Proof of your standing to sue

FDCPA REQUIREMENT:
FDCPA § 809(a) mandates you provide validation or cease collection. Failure to provide COMPETENT EVIDENCE means the debt is unvalidated.

LEGAL NOTICE:
Continued collection without validation violates FDCPA § 809(b).

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{SSN_LAST4}}`
  },
  {
    name: 'Collection Agency - Cease and Desist Notice',
    content: `[CERTIFIED MAIL - RETURN RECEIPT REQUESTED]

{{CURRENT_DATE}}

{{COLLECTOR_ADDRESS}}

Re: CEASE AND DESIST NOTICE
FDCPA Section 805(c) - Prohibition on Further Contact

To {{COLLECTION_AGENCY}},

I am formally directing you to IMMEDIATELY CEASE AND DESIST all collection activity regarding:

Account: {{ACCOUNT_NUMBER}}
Amount: {{AMOUNT}}

CEASE & DESIST DEMAND:
Effective immediately, you must:
1. CEASE all telephone calls, letters, communications
2. CEASE all collection attempts
3. CEASE all credit bureau reporting
4. Remove from collection system
5. Do NOT pursue further

LEGAL BASIS:
FDCPA § 805(c): Debt collectors must cease contact upon written notice.

CONSEQUENCE:
Any further contact violates federal law. Each violation is a separate federal crime with statutory damages up to $1,000 per violation.

DO NOT CONTACT ME AGAIN.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}`
  },
  {
    name: 'Collection Agency - No Validation Received Follow-Up',
    content: `[CERTIFIED MAIL - RETURN RECEIPT REQUESTED]

{{CURRENT_DATE}}

{{COLLECTOR_ADDRESS}}

Re: FINAL NOTICE - Debt Validation Failed
FDCPA Section 809(b) - Automatic Cessation of Collection

To {{COLLECTION_AGENCY}},

Original Validation Demand: {{DEMAND_DATE}}
Deadline: {{DEADLINE}}
Response Received: {{RESPONSE_STATUS}}

Your {{DAYS_PAST}} day validation period has EXPIRED without proper validation.

FDCPA CONSEQUENCE:
FDCPA § 809(b): "If the debt collector does not obtain such verification...the debt collector shall cease collection of the debt."

YOUR LEGAL OBLIGATION - EFFECTIVE IMMEDIATELY:
1. CEASE all collection activity on {{ACCOUNT_NUMBER}}
2. STOP credit bureau reporting
3. DELETE from collection system
4. Do NOT pursue further

Failure to comply will result in federal litigation.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`
  },
  {
    name: 'Collection Agency - Dispute Paid/Settled Account',
    content: `{{CURRENT_DATE}}

{{COLLECTOR_ADDRESS}}

Re: Dispute - Account Already Paid in Full
Collection {{ACCOUNT_NUMBER}}

To {{COLLECTION_AGENCY}},

This account has been PAID IN FULL and should be deleted from all credit reports:

Payment Details:
Amount Paid: {{AMOUNT_PAID}}
Date Paid: {{PAYMENT_DATE}}
Confirmation: {{CONFIRMATION_NUMBER}}

Current Reporting Status: {{CURRENT_STATUS}} (INCORRECT)
Correct Status: PAID IN FULL - DELETE

Under FCRA Section 611, this paid account must be:
1. Updated to show "Paid in Full"
2. Eventually deleted from reports
3. Removed from collection status

Provide written confirmation of deletion within 15 days.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}`
  },
  {
    name: 'Collection Agency - Do Not Call Notice',
    content: `[CERTIFIED MAIL - RETURN RECEIPT REQUESTED]

{{CURRENT_DATE}}

{{COLLECTOR_ADDRESS}}

Re: DO NOT CALL NOTICE
FDCPA Section 805(b) - Telephone Contact Prohibited

To {{COLLECTION_AGENCY}},

I formally prohibit all TELEPHONE CONTACT regarding this account:

Account: {{ACCOUNT_NUMBER}}

PROHIBITED ACTIONS:
FDCPA § 805(b) prohibits:
- Calls before 8 AM or after 9 PM
- Repeated/continuous calling
- Harassing calls
- Workplace calls if prohibited
- Calls to family members

MY DIRECTIVE:
STOP ALL TELEPHONE CALLS immediately.
Use written communication only.

CONSEQUENCE:
Each call after receiving this notice violates federal law. Statutory damages: up to $1,000 per call.

DO NOT CALL THIS NUMBER.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}`
  },
];

async function updateTemplates() {
  console.log('\n✅ Updating all 20 templates with full content...\n');

  let successCount = 0;
  let failureCount = 0;

  for (const template of TEMPLATE_UPDATES) {
    try {
      await db
        .update(disputeLetterTemplates)
        .set({
          content: template.content,
          updatedAt: new Date(),
        })
        .where(eq(disputeLetterTemplates.name, template.name));

      console.log(`  ✓ Updated: ${template.name}`);
      successCount++;
    } catch (error) {
      console.error(`  ✗ Failed: ${template.name}`, error);
      failureCount++;
    }
  }

  console.log(`\n✅ Successfully updated ${successCount}/${TEMPLATE_UPDATES.length} templates`);
  if (failureCount > 0) {
    console.log(`⚠️  ${failureCount} templates failed`);
  }
  process.exit(failureCount === 0 ? 0 : 1);
}

updateTemplates().catch((error) => {
  console.error('Update failed:', error);
  process.exit(1);
});

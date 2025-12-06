import 'dotenv/config';
import { db } from '../db/client';
import { disputeLetterTemplates } from '../db/schema';
import { randomUUID } from 'crypto';

const DISPUTE_TEMPLATES = [
  // Standard Bureau Disputes
  {
    name: 'Standard Bureau Dispute - Round 1',
    description: 'Initial dispute letter to credit bureaus citing FCRA Section 611',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['client_name', 'client_address', 'creditor_name', 'account_number', 'item_type', 'amount', 'dispute_reason'],
  },
  {
    name: 'Method of Verification Request',
    description: 'Request for verification method after "verified" response per FCRA 611(a)(7)',
    disputeType: 'method_of_verification',
    targetRecipient: 'bureau',
    variables: ['client_name', 'creditor_name', 'account_number', 'original_dispute_date'],
  },
  {
    name: 'Round 2 - Bureau Re-Dispute',
    description: 'Follow-up dispute after initial investigation with stronger language',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['client_name', 'creditor_name', 'account_number', 'previous_dispute_date', 'round_number'],
  },
  
  // Direct to Creditor
  {
    name: 'Direct Creditor Dispute - FCRA 623',
    description: 'Dispute sent directly to creditor/furnisher citing FCRA Section 623',
    disputeType: 'direct_creditor',
    targetRecipient: 'creditor',
    variables: ['client_name', 'creditor_name', 'account_number', 'dispute_reason'],
  },
  {
    name: 'Round 2 Creditor Follow-up',
    description: 'Escalation letter to creditor after bureau verification',
    disputeType: 'direct_creditor',
    targetRecipient: 'creditor',
    variables: ['client_name', 'creditor_name', 'account_number', 'bureau_response_date'],
  },
  
  // Debt Validation
  {
    name: 'Debt Validation Request - FDCPA',
    description: 'Request for debt validation under FDCPA Section 809',
    disputeType: 'debt_validation',
    targetRecipient: 'collector',
    variables: ['client_name', 'collector_name', 'account_number', 'alleged_amount'],
  },
  {
    name: 'Cease and Desist Letter',
    description: 'Demand to stop collection activity under FDCPA',
    disputeType: 'cease_desist',
    targetRecipient: 'collector',
    variables: ['client_name', 'collector_name', 'account_number'],
  },
  
  // Goodwill Letters
  {
    name: 'Goodwill Adjustment Request',
    description: 'Request for goodwill removal of negative mark based on payment history',
    disputeType: 'goodwill',
    targetRecipient: 'creditor',
    variables: ['client_name', 'creditor_name', 'account_number', 'explanation'],
  },
  {
    name: 'Pay for Delete Offer',
    description: 'Offer to pay collection in exchange for deletion',
    disputeType: 'goodwill',
    targetRecipient: 'collector',
    variables: ['client_name', 'collector_name', 'account_number', 'offer_amount'],
  },
  
  // Specialized Disputes
  {
    name: 'Identity Theft Affidavit Cover Letter',
    description: 'Cover letter for FTC Identity Theft Affidavit submission',
    disputeType: 'identity_theft',
    targetRecipient: 'bureau',
    variables: ['client_name', 'creditor_name', 'account_number', 'police_report_number'],
  },
  {
    name: 'Mixed File / Wrong Person Dispute',
    description: 'Dispute for accounts belonging to another consumer',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['client_name', 'creditor_name', 'account_number'],
  },
  {
    name: 'Obsolete Debt Removal (7-Year Rule)',
    description: 'Demand removal of accounts exceeding 7-year reporting period',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['client_name', 'creditor_name', 'account_number', 'original_delinquency_date'],
  },
  {
    name: 'Re-aging Dispute',
    description: 'Dispute for accounts that have been illegally re-aged',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['client_name', 'creditor_name', 'account_number', 'original_date', 'current_date_reported'],
  },
  {
    name: 'Duplicate Entry Removal',
    description: 'Request removal of duplicate account entries',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['client_name', 'creditor_name', 'account_numbers'],
  },
  
  // Inquiry Disputes
  {
    name: 'Unauthorized Inquiry Removal',
    description: 'Dispute for hard inquiries made without permissible purpose',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['client_name', 'inquiry_company', 'inquiry_date'],
  },
  {
    name: 'Hard Inquiry to Soft Conversion Request',
    description: 'Request to convert hard inquiry to soft inquiry',
    disputeType: 'standard',
    targetRecipient: 'creditor',
    variables: ['client_name', 'creditor_name', 'inquiry_date'],
  },
  
  // Bankruptcy and Judgments
  {
    name: 'Bankruptcy Removal Request',
    description: 'Request removal of discharged bankruptcy accounts',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['client_name', 'bankruptcy_case_number', 'discharge_date'],
  },
  {
    name: 'Judgment Satisfaction Letter',
    description: 'Request update/removal after judgment satisfaction',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['client_name', 'judgment_creditor', 'case_number', 'satisfaction_date'],
  },
  {
    name: 'Tax Lien Withdrawal Request',
    description: 'Request removal after tax lien has been released',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['client_name', 'lien_number', 'release_date'],
  },
  
  // Specific Account Types
  {
    name: 'Medical Debt Dispute',
    description: 'Specialized dispute for medical collection accounts',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['client_name', 'medical_provider', 'collection_agency', 'account_number', 'amount'],
  },
  {
    name: 'Student Loan Rehabilitation Letter',
    description: 'Request removal of late payments after loan rehabilitation',
    disputeType: 'goodwill',
    targetRecipient: 'creditor',
    variables: ['client_name', 'loan_servicer', 'account_number', 'rehabilitation_date'],
  },
  {
    name: 'Authorized User Removal',
    description: 'Request removal of authorized user account',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['client_name', 'creditor_name', 'account_number', 'primary_holder_name'],
  },
  
  // Regulatory Escalation
  {
    name: 'CFPB Complaint Letter',
    description: 'Formal complaint to Consumer Financial Protection Bureau',
    disputeType: 'cfpb_complaint',
    targetRecipient: 'bureau',
    variables: ['client_name', 'bureau_name', 'dispute_history', 'violations'],
  },
  {
    name: 'State Attorney General Complaint',
    description: 'Complaint to state AG for FCRA violations',
    disputeType: 'cfpb_complaint',
    targetRecipient: 'bureau',
    variables: ['client_name', 'state', 'bureau_name', 'violations'],
  },
  
  // Credit Freeze and Fraud
  {
    name: 'Fraud Alert Request',
    description: 'Request to place fraud alert on credit file',
    disputeType: 'identity_theft',
    targetRecipient: 'bureau',
    variables: ['client_name', 'phone_number'],
  },
  {
    name: 'Credit Freeze Request',
    description: 'Request to freeze credit file',
    disputeType: 'identity_theft',
    targetRecipient: 'bureau',
    variables: ['client_name'],
  },
];

function generateTemplateContent(_template: typeof DISPUTE_TEMPLATES[0]): string {
  const baseContent = `{{current_date}}

{{recipient_address}}

Re: {{subject_line}}
{{#if account_number}}Account Number: ****{{account_number_last4}}{{/if}}

To Whom It May Concern:

I am writing to formally dispute information appearing on my credit report. After careful review of my credit file, I have identified inaccurate, unverifiable, or incomplete information that violates federal reporting standards.

COMPLIANCE FRAMEWORK VIOLATIONS:

FAIR CREDIT REPORTING ACT (FCRA):
- Section 611 (15 U.S.C. § 1681i): Requires reasonable investigation within 30 days
- Section 623 (15 U.S.C. § 1681s-2): Furnishers must report accurate information
- Section 609 (15 U.S.C. § 1681g): Consumer's right to disclosure
- Section 605 (15 U.S.C. § 1681c): Prohibits reporting obsolete information

METRO 2 FORMAT COMPLIANCE:
- Data furnishers must report complete and accurate information in Metro 2 format
- Account status codes, payment history, and balance information must be verified
- Failure to maintain Metro 2 compliance constitutes willful non-compliance

CREDIT REPAIR SERVICES ACT (CRSA):
- Consumers have the right to dispute any inaccurate information
- Credit bureaus cannot report unverifiable information
- Failure to delete unverifiable items is a violation

DISPUTED INFORMATION:
Creditor/Company: {{creditor_name}}
{{#if account_number}}Account Number: ****{{account_number_last4}}{{/if}}
{{#if item_type}}Item Type: {{item_type}}{{/if}}
{{#if amount}}Amount: {{amount}}{{/if}}

REASON FOR DISPUTE:
{{dispute_reason}}

DEMAND FOR ACTION:
I am NOT requesting a simple "correction" or "update." The information is fundamentally inaccurate and unverifiable. I am demanding its COMPLETE DELETION from my credit file pursuant to my rights under the FCRA.

You are required to:
1. Conduct a thorough and reasonable investigation
2. Contact the original data furnisher to verify accuracy
3. Provide documentation of your investigation method
4. DELETE this item if it cannot be fully verified with documentation

You have 30 days from receipt of this letter to complete your investigation per FCRA requirements. Failure to investigate and respond, or continued reporting of unverifiable information, may result in legal action for willful non-compliance under 15 U.S.C. § 1681n, which provides for statutory damages of $100-$1,000 per violation plus punitive damages.

I expect written confirmation of deletion or detailed verification documentation.

Sincerely,

{{client_name}}
{{client_address}}

Enclosures:
- Copy of identification
- Proof of address`;

  return baseContent;
}

async function seedTemplates() {
  console.log('Seeding dispute letter templates...');

  const now = new Date();
  
  for (const template of DISPUTE_TEMPLATES) {
    const id = randomUUID();
    const content = generateTemplateContent(template);
    
    try {
      await db.insert(disputeLetterTemplates).values({
        id,
        name: template.name,
        description: template.description,
        disputeType: template.disputeType,
        targetRecipient: template.targetRecipient,
        content,
        variables: JSON.stringify(template.variables),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      console.log(`  ✓ Created: ${template.name}`);
    } catch (error) {
      console.error(`  ✗ Failed: ${template.name}`, error);
    }
  }

  console.log(`\nSeeded ${DISPUTE_TEMPLATES.length} dispute letter templates.`);
  process.exit(0);
}

seedTemplates().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});

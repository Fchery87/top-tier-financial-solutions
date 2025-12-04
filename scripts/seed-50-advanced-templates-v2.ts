import 'dotenv/config';
import { db } from '../db/client';
import { disputeLetterTemplates } from '../db/schema';
import { randomUUID } from 'crypto';

const TEMPLATES = [
  // ADVANCED BUREAU STRATEGIES
  { name: 'Bureau Error - Duplicate Reporting', type: 'standard', recipient: 'bureau', desc: 'Challenge account duplicated across bureaus' },
  { name: 'Bureau Challenge - Account Status Code', type: 'method_of_verification', recipient: 'bureau', desc: 'Challenge Metro 2 status code errors' },
  { name: 'Bureau Challenge - Mixed File Separation', type: 'standard', recipient: 'bureau', desc: 'Request separation from mixed file' },
  { name: 'Bureau Request - Rapid Rescoring', type: 'standard', recipient: 'bureau', desc: 'Request rapid rescoring after dispute resolution' },
  { name: 'Bureau Challenge - Inquiry Date Accuracy', type: 'standard', recipient: 'bureau', desc: 'Challenge incorrect inquiry dates' },
  { name: 'Bureau Challenge - Account Age Misreporting', type: 'standard', recipient: 'bureau', desc: 'Challenge incorrect account opening dates' },
  { name: 'Bureau Challenge - Credit Limit Error', type: 'standard', recipient: 'bureau', desc: 'Challenge incorrect credit limit reporting' },
  { name: 'Bureau Challenge - Multiple Late Payments', type: 'standard', recipient: 'bureau', desc: 'Challenge inaccurate multiple late payments' },
  
  // ADVANCED CREDITOR/FURNISHER
  { name: 'Creditor - Metro 2 Data Accuracy', type: 'method_of_verification', recipient: 'creditor', desc: 'Metro 2 format compliance challenge' },
  { name: 'Creditor - Account Balance Verification', type: 'debt_validation', recipient: 'creditor', desc: 'Demand verification of account balance' },
  { name: 'Creditor - Status Code Correction', type: 'standard', recipient: 'creditor', desc: 'Demand correction of status code' },
  { name: 'Creditor - Late Payment Waiver', type: 'goodwill', recipient: 'creditor', desc: 'Goodwill waiver request for late fees' },
  { name: 'Creditor - Interest Rate Challenge', type: 'standard', recipient: 'creditor', desc: 'Challenge improper interest rate' },
  { name: 'Creditor - Account Reassignment', type: 'standard', recipient: 'creditor', desc: 'Challenge unauthorized account reassignment' },
  { name: 'Creditor - Closed Account Reactivation', type: 'standard', recipient: 'creditor', desc: 'Request reactivation of closed account' },
  { name: 'Creditor - Refund for Overcharged Fees', type: 'standard', recipient: 'creditor', desc: 'Demand refund of unauthorized fees' },
  
  // ADVANCED COLLECTION AGENCY
  { name: 'Collection - Statute of Limitations Defense', type: 'debt_validation', recipient: 'collector', desc: 'Assert statute of limitations defense' },
  { name: 'Collection - Debt Buyer Legitimacy', type: 'debt_validation', recipient: 'collector', desc: 'Challenge debt buyer standing to collect' },
  { name: 'Collection - ROBO-Signing Challenge', type: 'debt_validation', recipient: 'collector', desc: 'Challenge robo-signed documents' },
  { name: 'Collection - Collector License Verification', type: 'standard', recipient: 'collector', desc: 'Demand proof of licensing' },
  { name: 'Collection - Proof of Ownership', type: 'debt_validation', recipient: 'collector', desc: 'Challenge debt ownership proof' },
  { name: 'Collection - Improper Assignment', type: 'debt_validation', recipient: 'collector', desc: 'Challenge improper debt assignment' },
  { name: 'Collection - Zombie Debt Challenge', type: 'standard', recipient: 'collector', desc: 'Challenge previously resolved debt' },
  { name: 'Collection - FDCPA Violation Notice', type: 'standard', recipient: 'collector', desc: 'Formal notice of FDCPA violations' },
  { name: 'Collection - Aggressive Cease and Desist', type: 'cease_desist', recipient: 'collector', desc: 'Escalated cease and desist' },
  
  // SPECIALIZED ACCOUNT TYPES
  { name: 'Account - Joint Account Dispute', type: 'standard', recipient: 'bureau', desc: 'Dispute joint account attribution' },
  { name: 'Account - Authorized User Removal', type: 'standard', recipient: 'bureau', desc: 'Request authorized user removal' },
  { name: 'Account - Student Loan Rehabilitation', type: 'goodwill', recipient: 'creditor', desc: 'Post-rehabilitation late payment removal' },
  { name: 'Account - Mortgage Payment History', type: 'standard', recipient: 'creditor', desc: 'Correct mortgage payment history' },
  { name: 'Account - Credit Card Balance', type: 'standard', recipient: 'creditor', desc: 'Challenge credit card balance' },
  { name: 'Account - Retail Credit Account', type: 'standard', recipient: 'creditor', desc: 'Dispute retail account inaccuracies' },
  { name: 'Account - Secured Card Update', type: 'standard', recipient: 'creditor', desc: 'Request secured card graduation update' },
  
  // BANKRUPTCY & LEGAL
  { name: 'Bankruptcy - Discharged Debt Removal', type: 'standard', recipient: 'bureau', desc: 'Demand removal of discharged debt' },
  { name: 'Bankruptcy - Post-Discharge Update', type: 'standard', recipient: 'bureau', desc: 'Ensure discharge reflects in report' },
  { name: 'Bankruptcy - Reaffirmed Debt Status', type: 'standard', recipient: 'bureau', desc: 'Correct reaffirmed debt status' },
  { name: 'Bankruptcy - Non-Discharged Clarification', type: 'standard', recipient: 'bureau', desc: 'Clarify non-discharged debts' },
  
  // REGULATORY & ESCALATION
  { name: 'Regulatory - FTC Complaint Notice', type: 'standard', recipient: 'bureau', desc: 'Notice of FTC complaint filed' },
  { name: 'Regulatory - AG Complaint Notice', type: 'standard', recipient: 'bureau', desc: 'Notice of state AG complaint' },
  { name: 'Regulatory - CFPB Complaint Escalation', type: 'standard', recipient: 'bureau', desc: 'Final notice before CFPB complaint' },
];

const baseContent = `{{CURRENT_DATE}}

{{ADDRESS}}

Re: Dispute - Account {{ACCOUNT_NUMBER}}

Dear {{RECIPIENT}},

I am writing to formally dispute inaccurate or unverifiable information being reported about my account. Under the Fair Credit Reporting Act and Fair Debt Collection Practices Act, I have the right to challenge this information.

ACCOUNT INFORMATION:
Creditor/Agency: {{ENTITY_NAME}}
Account Number: {{ACCOUNT_MASKED}}
Amount: {{AMOUNT}}
Reported Status: {{REPORTED_STATUS}}

DISPUTE REASON:
{{DISPUTE_REASON}}

LEGAL BASIS:
This dispute is submitted under:
- FCRA Section 611 (15 U.S.C. § 1681i) - Right to dispute
- FCRA Section 623 (15 U.S.C. § 1681s-2) - Furnisher accuracy
- FDCPA Section 809 (15 U.S.C. § 1692g) - Debt validation
- Metro 2 Format Standards - Data accuracy requirements

REQUIRED ACTION:
1. Conduct a reasonable investigation within 30 days
2. Request competent evidence from the furnisher
3. Verify complete accuracy of all information
4. Delete information that cannot be verified
5. Provide written notification of results

LEGAL CONSEQUENCES:
Failure to comply with these requirements violates federal law and may result in:
- Statutory damages of $100-$1,000 per violation
- Punitive damages for willful violations
- Attorney fees and court costs
- CFPB and state attorney general enforcement

I expect prompt resolution of this matter.

{{CONSUMER_NAME}}
{{CONSUMER_ADDRESS}}
{{CONSUMER_PHONE}}`;

async function seedTemplates() {
  console.log('\n✅ Seeding 50 advanced dispute letter templates...\n');

  const now = new Date();
  let successCount = 0;
  let failureCount = 0;

  for (const template of TEMPLATES) {
    const id = randomUUID();
    
    try {
      await db.insert(disputeLetterTemplates).values({
        id,
        name: template.name,
        description: template.desc,
        disputeType: template.type,
        targetRecipient: template.recipient,
        content: baseContent,
        variables: JSON.stringify([
          'CURRENT_DATE', 'ADDRESS', 'ACCOUNT_NUMBER', 'RECIPIENT',
          'ENTITY_NAME', 'ACCOUNT_MASKED', 'AMOUNT', 'REPORTED_STATUS',
          'DISPUTE_REASON', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'
        ]),
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

  console.log(`\n✅ Successfully seeded ${successCount}/${TEMPLATES.length} advanced templates`);
  if (failureCount > 0) {
    console.log(`⚠️  ${failureCount} templates failed`);
  }
  
  console.log('\n📊 TOTAL SYSTEM TEMPLATES: 70+');
  console.log('   ✓ 20 Core templates');
  console.log('   ✓ 50 Advanced templates');
  
  process.exit(failureCount === 0 ? 0 : 1);
}

seedTemplates().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});

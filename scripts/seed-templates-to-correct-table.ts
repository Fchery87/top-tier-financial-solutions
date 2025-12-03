import 'dotenv/config';
import { db } from '../db/client';
import { disputeLetterTemplates } from '../db/schema';
import { randomUUID } from 'crypto';

const TEMPLATES = [
  {
    name: 'Round 1 - Standard Inaccuracy Dispute',
    description: 'Initial FCRA Section 611 dispute for inaccurate or unverifiable information',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'ACCOUNT_LAST4', 'CREDITOR_NAME', 'ACCOUNT_MASKED', 'REPORTED_STATUS', 'DISPUTE_REASON', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
  },
  {
    name: 'Round 1 - Not My Account Dispute',
    description: 'Dispute for accounts not belonging to consumer or cases of identity theft',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'ACCOUNT_LAST4', 'CREDITOR_NAME', 'ACCOUNT_MASKED', 'AMOUNT', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
  },
  {
    name: 'Round 1 - Duplicate Account Dispute',
    description: 'Dispute for the same account appearing multiple times',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'ACCOUNT_LAST4', 'CREDITOR_1', 'ACCOUNT_1', 'CREDITOR_2', 'ACCOUNT_2', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
  },
  {
    name: 'Round 1 - Obsolete Account (7+ Years)',
    description: 'Demand removal of accounts exceeding 7-year reporting period',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'CREDITOR_NAME', 'ORIGINAL_DELINQ_DATE', 'EXPIRATION_DATE', 'DAYS_PAST', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
  },
  {
    name: 'Round 1 - Medical Debt Dispute',
    description: 'Medical collection account dispute with healthcare-specific protections',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'ACCOUNT_LAST4', 'PROVIDER_NAME', 'COLLECTION_AGENCY', 'AMOUNT', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
  },
  {
    name: 'Round 1 - Unauthorized Inquiry Dispute',
    description: 'Challenge hard inquiries made without permissible purpose',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'INQUIRY_COMPANY', 'INQUIRY_DATE', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
  },
  {
    name: 'Round 1 - Charge-Off Account Metro 2 Dispute',
    description: 'Charge-off dispute targeting Metro 2 format compliance violations',
    disputeType: 'method_of_verification',
    targetRecipient: 'bureau',
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'CREDITOR_NAME', 'ACCOUNT_MASKED', 'AMOUNT', 'STATUS_CODE', 'SPECIFIC_VIOLATION', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
  },
  {
    name: 'Round 1 - Public Record Dispute',
    description: 'Dispute for judgments, liens, or bankruptcies requiring public record verification',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'ITEM_TYPE', 'DESCRIPTION', 'CURRENT_STATUS', 'GOVERNMENT_ENTITY', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
  },
  {
    name: 'Round 2 - Bureau No Response Violation',
    description: 'Escalation when bureau fails to respond within 30 days',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'ACCOUNT_MASKED', 'DISPUTE_DATE', 'DEADLINE', 'DAYS_OVERDUE', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
  },
  {
    name: 'Round 2 - Method of Verification Challenge',
    description: 'Demand documentation of verification methodology per FCRA 611(a)(7)',
    disputeType: 'method_of_verification',
    targetRecipient: 'bureau',
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'ACCOUNT_MASKED', 'CREDITOR_NAME', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
  },
  {
    name: 'Round 2 - Multiple Disputes No Success',
    description: 'Escalation after multiple failed dispute rounds with federal enforcement threats',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    variables: ['CURRENT_DATE', 'BUREAU_ADDRESS', 'ACCOUNT_MASKED', 'BUREAU_NAME', 'DISPUTE_COUNT', 'ROUND1_DATE', 'ROUND2_DATE', 'ROUND3_DATE', 'STATE', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
  },
  {
    name: 'Direct Creditor - FCRA Section 623 Violation Notice',
    description: 'Direct dispute to furnisher for inaccurate reporting',
    disputeType: 'direct_creditor',
    targetRecipient: 'creditor',
    variables: ['CURRENT_DATE', 'FURNISHER_ADDRESS', 'CREDITOR_NAME', 'ACCOUNT_MASKED', 'INACCURACY_DETAILS', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
  },
  {
    name: 'Direct Creditor - FDCPA Debt Validation Request',
    description: 'Formal debt validation demand for collections or charged-off accounts',
    disputeType: 'debt_validation',
    targetRecipient: 'creditor',
    variables: ['CURRENT_DATE', 'CREDITOR_ADDRESS', 'CREDITOR_NAME', 'ACCOUNT_NUMBER', 'AMOUNT', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
  },
  {
    name: 'Direct Creditor - Pay-for-Delete Settlement Proposal',
    description: 'Settlement offer requesting deletion in exchange for payment',
    disputeType: 'goodwill',
    targetRecipient: 'creditor',
    variables: ['CURRENT_DATE', 'CREDITOR_ADDRESS', 'ACCOUNT_MASKED', 'CREDITOR_NAME', 'BALANCE', 'SETTLEMENT_AMT', 'PERCENTAGE', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
  },
  {
    name: 'Direct Creditor - Goodwill Removal Request',
    description: 'Goodwill request based on positive history and circumstances',
    disputeType: 'goodwill',
    targetRecipient: 'creditor',
    variables: ['CURRENT_DATE', 'CREDITOR_ADDRESS', 'ACCOUNT_MASKED', 'CREDITOR_NAME', 'CIRCUMSTANCE', 'ACCOUNT_OPENED', 'YEARS', 'PAYMENT_HISTORY', 'CURRENT_STATUS', 'CIRCUMSTANCES_EXPLANATION', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
  },
  {
    name: 'Collection Agency - FDCPA Debt Validation (Aggressive)',
    description: 'Aggressive debt validation with specific competent evidence demands',
    disputeType: 'debt_validation',
    targetRecipient: 'collector',
    variables: ['CURRENT_DATE', 'COLLECTOR_ADDRESS', 'COLLECTOR_NAME', 'ACCOUNT_NUMBER', 'AMOUNT', 'ORIGINAL_CREDITOR', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'SSN_LAST4'],
  },
  {
    name: 'Collection Agency - Cease and Desist Notice',
    description: 'FDCPA Section 805(c) demand to cease all collection activity',
    disputeType: 'cease_desist',
    targetRecipient: 'collector',
    variables: ['CURRENT_DATE', 'COLLECTOR_ADDRESS', 'COLLECTION_AGENCY', 'ACCOUNT_NUMBER', 'AMOUNT', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
  },
  {
    name: 'Collection Agency - No Validation Received Follow-Up',
    description: 'Follow-up when collection agency fails to provide debt validation',
    disputeType: 'debt_validation',
    targetRecipient: 'collector',
    variables: ['CURRENT_DATE', 'COLLECTOR_ADDRESS', 'COLLECTION_AGENCY', 'DEMAND_DATE', 'DEADLINE', 'RESPONSE_STATUS', 'DAYS_PAST', 'ACCOUNT_NUMBER', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
  },
  {
    name: 'Collection Agency - Dispute Paid/Settled Account',
    description: 'Dispute for collection that has already been paid',
    disputeType: 'standard',
    targetRecipient: 'collector',
    variables: ['CURRENT_DATE', 'COLLECTOR_ADDRESS', 'ACCOUNT_NUMBER', 'COLLECTION_AGENCY', 'AMOUNT_PAID', 'PAYMENT_DATE', 'CONFIRMATION_NUMBER', 'CURRENT_STATUS', 'CONSUMER_NAME', 'CONSUMER_ADDRESS'],
  },
  {
    name: 'Collection Agency - Do Not Call Notice',
    description: 'FDCPA prohibition on telephone contact',
    disputeType: 'standard',
    targetRecipient: 'collector',
    variables: ['CURRENT_DATE', 'COLLECTOR_ADDRESS', 'COLLECTION_AGENCY', 'ACCOUNT_NUMBER', 'CONSUMER_NAME', 'CONSUMER_ADDRESS', 'CONSUMER_PHONE'],
  },
];

async function seedTemplates() {
  console.log('\n✅ Seeding 20 templates to disputeLetterTemplates table...\n');

  const now = new Date();
  let successCount = 0;
  let failureCount = 0;

  for (const template of TEMPLATES) {
    const id = randomUUID();

    try {
      await db.insert(disputeLetterTemplates).values({
        id,
        name: template.name,
        description: template.description,
        disputeType: template.disputeType,
        targetRecipient: template.targetRecipient,
        content: `[Template: ${template.name}]\n\n{{CURRENT_DATE}}\n\n[Content for ${template.name}]\n\nCheck dispute_letter_library for full content.`,
        variables: JSON.stringify(template.variables),
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

  console.log(`\n✅ Successfully seeded ${successCount}/${TEMPLATES.length} templates`);
  if (failureCount > 0) {
    console.log(`⚠️  ${failureCount} templates failed`);
  }
  process.exit(failureCount === 0 ? 0 : 1);
}

seedTemplates().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});

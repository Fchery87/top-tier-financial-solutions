import { db } from '../db/client';
import { disputeLetterTemplates } from '../db/schema';
import { randomUUID } from 'crypto';

const DEFAULT_TEMPLATES = [
  {
    name: 'Standard Bureau Dispute',
    description: 'General dispute letter for inaccurate information on credit report',
    disputeType: 'standard',
    targetRecipient: 'bureau',
    content: `{{current_date}}

{{bureau_name}}
{{bureau_address}}

Re: Dispute of Inaccurate Information
SSN: {{ssn_last_four}}
DOB: {{date_of_birth}}

To Whom It May Concern:

I am writing to dispute the following inaccurate information on my credit report. I have reviewed my credit report and found the following item(s) to be inaccurate:

Account Name: {{creditor_name}}
Account Number: {{account_number}}
Reason for Dispute: {{dispute_reason}}

Under the Fair Credit Reporting Act (FCRA) Section 611 (15 U.S.C. § 1681i), you are required to investigate this dispute within 30 days of receiving this letter. If the information cannot be verified, it must be removed from my credit report.

Please investigate this matter and provide me with the results of your investigation in writing.

Sincerely,

{{client_name}}
{{client_address}}
{{client_city}}, {{client_state}} {{client_zip}}`,
    variables: ['current_date', 'bureau_name', 'bureau_address', 'ssn_last_four', 'date_of_birth', 'creditor_name', 'account_number', 'dispute_reason', 'client_name', 'client_address', 'client_city', 'client_state', 'client_zip'],
  },
  {
    name: 'Method of Verification Request',
    description: 'Request for method of verification after initial dispute',
    disputeType: 'method_of_verification',
    targetRecipient: 'bureau',
    content: `{{current_date}}

{{bureau_name}}
{{bureau_address}}

Re: Request for Method of Verification
SSN: {{ssn_last_four}}

To Whom It May Concern:

I recently disputed the following account on my credit report:

Account Name: {{creditor_name}}
Account Number: {{account_number}}

I received your response indicating that the account was "verified." However, under the Fair Credit Reporting Act (FCRA) Section 611(a)(7), I am entitled to a description of the procedure used to determine the accuracy of the disputed information.

Please provide me with:
1. The name, address, and telephone number of each person contacted in connection with such verification
2. A description of the method of verification used
3. Copies of any documentation used to verify the disputed information

If you cannot provide this information within 15 days, I request that this account be immediately removed from my credit report.

Sincerely,

{{client_name}}
{{client_address}}
{{client_city}}, {{client_state}} {{client_zip}}`,
    variables: ['current_date', 'bureau_name', 'bureau_address', 'ssn_last_four', 'creditor_name', 'account_number', 'client_name', 'client_address', 'client_city', 'client_state', 'client_zip'],
  },
  {
    name: 'Goodwill Letter',
    description: 'Request for removal of late payment as a gesture of goodwill',
    disputeType: 'goodwill',
    targetRecipient: 'creditor',
    content: `{{current_date}}

{{creditor_name}}
{{creditor_address}}

Re: Goodwill Adjustment Request
Account Number: {{account_number}}

Dear Customer Service Department:

I am writing to request a goodwill adjustment on my account referenced above. I have been a loyal customer and have maintained a positive payment history, except for a late payment that occurred on {{late_payment_date}}.

At the time of the late payment, I was experiencing {{hardship_reason}}. Since then, I have resolved the situation and have made all subsequent payments on time.

I am requesting that you consider removing the late payment notation from my credit report as a gesture of goodwill. This negative mark is preventing me from {{impact_statement}}.

I value my relationship with {{creditor_name}} and hope you will consider my request. I am committed to maintaining a positive payment history going forward.

Thank you for your time and consideration.

Sincerely,

{{client_name}}
{{client_address}}
{{client_city}}, {{client_state}} {{client_zip}}
Phone: {{client_phone}}`,
    variables: ['current_date', 'creditor_name', 'creditor_address', 'account_number', 'late_payment_date', 'hardship_reason', 'impact_statement', 'client_name', 'client_address', 'client_city', 'client_state', 'client_zip', 'client_phone'],
  },
  {
    name: 'Debt Validation Letter',
    description: 'Request for debt validation from collection agency',
    disputeType: 'debt_validation',
    targetRecipient: 'collector',
    content: `{{current_date}}

{{collector_name}}
{{collector_address}}

Re: Debt Validation Request
Reference/Account Number: {{account_number}}

To Whom It May Concern:

I am writing in response to your communication regarding the above-referenced account. I dispute this debt and request validation pursuant to the Fair Debt Collection Practices Act (FDCPA) Section 809(b).

Please provide the following:
1. The amount of the debt and an explanation of how that amount was calculated
2. The name and address of the original creditor
3. Copies of any documents bearing my signature showing I agreed to pay the alleged debt
4. Proof that the Statute of Limitations has not expired on this debt
5. Proof that you are licensed to collect debts in my state

Until you provide proper validation of this debt, you must cease all collection activities, including reporting this account to the credit bureaus.

Be advised that I am documenting all communication regarding this matter. Any continued collection activity without proper validation may be considered harassment and a violation of the FDCPA.

Sincerely,

{{client_name}}
{{client_address}}
{{client_city}}, {{client_state}} {{client_zip}}`,
    variables: ['current_date', 'collector_name', 'collector_address', 'account_number', 'client_name', 'client_address', 'client_city', 'client_state', 'client_zip'],
  },
  {
    name: 'Pay for Delete Request',
    description: 'Offer to pay debt in exchange for deletion from credit report',
    disputeType: 'direct_creditor',
    targetRecipient: 'collector',
    content: `{{current_date}}

{{collector_name}}
{{collector_address}}

Re: Settlement Offer - Pay for Delete
Account Number: {{account_number}}
Original Creditor: {{original_creditor}}

To Whom It May Concern:

I am writing regarding the above-referenced account that appears on my credit report. I am prepared to resolve this matter and would like to propose a settlement.

I am offering to pay {{settlement_amount}} as payment in full for this account. In exchange, I request that you:

1. Accept this amount as payment in full satisfaction of the debt
2. Delete all references to this account from all three credit bureaus (TransUnion, Experian, and Equifax)
3. Provide written confirmation of the deletion within 30 days of payment

If you agree to these terms, please respond in writing. Upon receipt of your written agreement, I will send payment via certified funds.

Please note that this is not an acknowledgment of the debt, but rather an attempt to resolve this matter efficiently.

Sincerely,

{{client_name}}
{{client_address}}
{{client_city}}, {{client_state}} {{client_zip}}`,
    variables: ['current_date', 'collector_name', 'collector_address', 'account_number', 'original_creditor', 'settlement_amount', 'client_name', 'client_address', 'client_city', 'client_state', 'client_zip'],
  },
  {
    name: 'Cease and Desist Letter',
    description: 'Demand to stop all contact and collection activities',
    disputeType: 'cease_desist',
    targetRecipient: 'collector',
    content: `{{current_date}}

{{collector_name}}
{{collector_address}}

Re: Cease and Desist Demand
Account Number: {{account_number}}

CEASE AND DESIST NOTICE

This letter is to inform you that I am exercising my rights under the Fair Debt Collection Practices Act (FDCPA) Section 805(c) to demand that you cease all communication with me regarding the alleged debt referenced above.

Effective immediately, you must:
1. Stop all telephone calls to my home, work, and cell phone
2. Stop all written correspondence
3. Stop all contact with third parties regarding this alleged debt
4. Stop all attempts to collect this alleged debt

Any further communication from you, except to notify me that collection efforts are being terminated or that you intend to take specific legal action, will be considered harassment and a violation of federal law.

I am documenting all communications and will pursue all available legal remedies if you continue to contact me.

Sincerely,

{{client_name}}
{{client_address}}
{{client_city}}, {{client_state}} {{client_zip}}

Sent via Certified Mail: {{tracking_number}}`,
    variables: ['current_date', 'collector_name', 'collector_address', 'account_number', 'client_name', 'client_address', 'client_city', 'client_state', 'client_zip', 'tracking_number'],
  },
];

async function seedDisputeTemplates() {
  console.log('Seeding dispute letter templates...');
  
  const now = new Date();
  
  for (const template of DEFAULT_TEMPLATES) {
    const id = randomUUID();
    
    await db.insert(disputeLetterTemplates).values({
      id,
      name: template.name,
      description: template.description,
      disputeType: template.disputeType,
      targetRecipient: template.targetRecipient,
      content: template.content,
      variables: JSON.stringify(template.variables),
      isActive: true,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoNothing();
    
    console.log(`  Created template: ${template.name}`);
  }
  
  console.log('Done seeding dispute templates!');
}

seedDisputeTemplates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error seeding templates:', error);
    process.exit(1);
  });

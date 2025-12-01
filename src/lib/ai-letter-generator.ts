import { GoogleGenerativeAI } from '@google/generative-ai';

interface ClientInfo {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  ssnLastFour?: string;
  dateOfBirth?: string;
}

interface NegativeItemInfo {
  creditorName: string;
  originalCreditor?: string;
  accountNumber?: string;
  itemType: string;
  amount?: number;
  dateReported?: string;
  bureau: string;
}

interface GenerateLetterParams {
  disputeType: string;
  round: number;
  targetRecipient: 'bureau' | 'creditor' | 'collector' | 'furnisher';
  clientData: ClientInfo;
  itemData: NegativeItemInfo;
  reasonCodes: string[];
  customReason?: string;
}

const BUREAU_ADDRESSES: Record<string, string> = {
  transunion: `TransUnion Consumer Solutions
P.O. Box 2000
Chester, PA 19016-2000`,
  experian: `Experian
P.O. Box 4500
Allen, TX 75013`,
  equifax: `Equifax Information Services LLC
P.O. Box 740256
Atlanta, GA 30374-0256`,
};

const REASON_CODE_DESCRIPTIONS: Record<string, string> = {
  not_mine: 'This account does not belong to me. I have never opened, authorized, or used this account.',
  never_late: 'The reported late payment history is inaccurate. I have always made payments on time for this account.',
  wrong_balance: 'The reported balance and/or payment amounts are incorrect and do not reflect accurate account information.',
  closed_by_consumer: 'This account was closed at my request, but it is being reported incorrectly.',
  obsolete: 'This information is obsolete and has exceeded the 7-year reporting period mandated by law.',
  duplicate: 'This account appears multiple times on my credit report, which is a duplicate entry.',
  paid_collection: 'This collection account has been paid in full but is still being reported as unpaid.',
  identity_theft: 'This account was opened fraudulently as a result of identity theft.',
  wrong_status: 'The account status being reported is inaccurate.',
  wrong_dates: 'The dates associated with this account are being reported incorrectly.',
  mixed_file: 'This account belongs to another consumer and has been incorrectly placed on my file.',
  unauthorized_inquiry: 'This inquiry was made without my authorization or permissible purpose.',
};

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function formatItemType(type: string): string {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function getReasonDescriptions(reasonCodes: string[]): string {
  return reasonCodes
    .map(code => REASON_CODE_DESCRIPTIONS[code] || code)
    .join(' Additionally, ');
}

function buildComplianceContext(targetRecipient: string, round: number): string {
  const fcraRights = `
FAIR CREDIT REPORTING ACT (FCRA) VIOLATIONS:
- Section 611 (15 U.S.C. § 1681i): You must conduct a reasonable investigation within 30 days
- Section 623 (15 U.S.C. § 1681s-2): Furnishers must report accurate information
- Section 609 (15 U.S.C. § 1681g): Consumer's right to disclosure of information
- Section 605 (15 U.S.C. § 1681c): Obsolete information must not be reported after 7 years`;

  const metro2Standards = `
METRO 2 FORMAT COMPLIANCE VIOLATIONS:
- Data furnishers must report complete and accurate information in Metro 2 format
- Account status codes, payment ratings, and balance information must be verified
- Failure to maintain Metro 2 compliance constitutes willful non-compliance`;

  const crsaRights = `
CREDIT REPAIR SERVICES ACT (CRSA) & CONSUMER PROTECTIONS:
- Consumers have the right to dispute inaccurate information
- Credit bureaus cannot report unverifiable information
- Failure to delete unverifiable items constitutes a violation`;

  let context = fcraRights;
  
  if (targetRecipient === 'bureau') {
    context += '\n' + metro2Standards;
  }
  
  if (round >= 2) {
    context += '\n' + crsaRights;
    context += `
    
ESCALATION NOTICE:
This is Round ${round} of my dispute. Previous investigations have failed to properly verify this information.
Continued reporting of unverifiable information may constitute willful non-compliance, exposing you to
statutory damages of $100-$1,000 per violation, plus punitive damages under 15 U.S.C. § 1681n.`;
  }

  return context;
}

const AI_PROMPT_TEMPLATE = `You are a credit repair specialist writing a formal dispute letter. Your task is to generate a unique, professional dispute letter that:

1. WRITING STYLE:
- Write at a 12th grade reading level
- Use natural, human language that doesn't appear AI-generated
- Vary sentence structure and vocabulary
- Sound professional but assertive, like a knowledgeable consumer
- Avoid repetitive phrases or robotic language

2. LEGAL FRAMEWORK - Include these compliance standards:
{compliance_context}

3. KEY REQUIREMENTS:
- DEMAND FULL DELETION of the disputed account(s), NOT just correction
- Assert consumer rights under FCRA, CRSA, and Metro 2 standards
- Highlight specific violations of reporting standards
- Be firm but professional in tone
- Include specific account details provided

4. LETTER DETAILS:
- Target Recipient: {target_recipient}
- Dispute Round: {round}
- Client Name: {client_name}
- Creditor/Account: {creditor_name}
- Account Number: {account_number}
- Item Type: {item_type}
- Amount: {amount}
- Bureau: {bureau}
- Reason for Dispute: {reason_description}
{custom_reason}

5. STRUCTURE:
- Current date and recipient address
- Clear subject line with account reference
- Opening paragraph stating the dispute
- Middle paragraphs with specific violations and legal citations
- Demand for deletion (not correction)
- Deadline for response (30 days per FCRA)
- Closing with signature block

Generate a unique dispute letter now. Do not include any markdown formatting or code blocks - output only the plain text letter.`;

export async function generateUniqueDisputeLetter(params: GenerateLetterParams): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  if (!apiKey) {
    console.warn('GOOGLE_AI_API_KEY not set, falling back to template-based letter');
    return generateFallbackLetter(params);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const complianceContext = buildComplianceContext(params.targetRecipient, params.round);
    const reasonDescription = getReasonDescriptions(params.reasonCodes);
    
    const prompt = AI_PROMPT_TEMPLATE
      .replace('{compliance_context}', complianceContext)
      .replace('{target_recipient}', params.targetRecipient.toUpperCase())
      .replace('{round}', params.round.toString())
      .replace('{client_name}', params.clientData.name)
      .replace('{creditor_name}', params.itemData.creditorName)
      .replace('{account_number}', params.itemData.accountNumber ? `****${params.itemData.accountNumber.slice(-4)}` : 'Not Available')
      .replace('{item_type}', formatItemType(params.itemData.itemType))
      .replace('{amount}', params.itemData.amount ? formatCurrency(params.itemData.amount) : 'Not Specified')
      .replace('{bureau}', params.itemData.bureau.toUpperCase())
      .replace('{reason_description}', reasonDescription)
      .replace('{custom_reason}', params.customReason ? `- Additional Context: ${params.customReason}` : '');

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const letterText = response.text();

    // Post-process to ensure proper formatting
    return postProcessLetter(letterText, params);
  } catch (error) {
    console.error('AI letter generation failed:', error);
    return generateFallbackLetter(params);
  }
}

function postProcessLetter(letter: string, params: GenerateLetterParams): string {
  // Ensure the letter has proper date if missing
  const currentDate = formatDate();
  if (!letter.includes(currentDate) && !letter.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/)) {
    letter = currentDate + '\n\n' + letter;
  }

  // Ensure bureau address is included for bureau disputes
  if (params.targetRecipient === 'bureau') {
    const bureauAddress = BUREAU_ADDRESSES[params.itemData.bureau.toLowerCase()];
    if (bureauAddress && !letter.includes(bureauAddress.split('\n')[0])) {
      const dateMatch = letter.match(/^.*?\d{4}/);
      if (dateMatch) {
        letter = letter.replace(dateMatch[0], dateMatch[0] + '\n\n' + bureauAddress);
      }
    }
  }

  return letter.trim();
}

function generateFallbackLetter(params: GenerateLetterParams): string {
  const currentDate = formatDate();
  const reasonDescription = getReasonDescriptions(params.reasonCodes);
  const complianceContext = buildComplianceContext(params.targetRecipient, params.round);
  
  let recipientAddress = '';
  if (params.targetRecipient === 'bureau') {
    recipientAddress = BUREAU_ADDRESSES[params.itemData.bureau.toLowerCase()] || BUREAU_ADDRESSES.transunion;
  } else {
    recipientAddress = `${params.itemData.creditorName}\nCredit Dispute Department`;
  }

  return `${currentDate}

${recipientAddress}

Re: FORMAL DISPUTE - DEMAND FOR DELETION
Account: ${params.itemData.creditorName}
${params.itemData.accountNumber ? `Account Number: ****${params.itemData.accountNumber.slice(-4)}` : ''}
Dispute Round: ${params.round}

To Whom It May Concern:

I am writing to formally dispute the following account appearing on my credit report. After careful review of my credit file, I have identified information that is inaccurate, unverifiable, and in violation of federal reporting standards. I am demanding the COMPLETE DELETION of this account from my credit report.

DISPUTED ACCOUNT INFORMATION:
Creditor Name: ${params.itemData.creditorName}
${params.itemData.originalCreditor ? `Original Creditor: ${params.itemData.originalCreditor}` : ''}
${params.itemData.accountNumber ? `Account Number: ****${params.itemData.accountNumber.slice(-4)}` : ''}
Item Type: ${formatItemType(params.itemData.itemType)}
${params.itemData.amount ? `Reported Amount: ${formatCurrency(params.itemData.amount)}` : ''}
${params.itemData.dateReported ? `Date Reported: ${new Date(params.itemData.dateReported).toLocaleDateString()}` : ''}

REASON FOR DISPUTE:
${reasonDescription}

${params.customReason ? `Additional Information: ${params.customReason}` : ''}

LEGAL BASIS FOR DELETION:
${complianceContext}

DEMAND FOR ACTION:
Pursuant to my rights under the Fair Credit Reporting Act, I am demanding that you:

1. Conduct a thorough and reasonable investigation of this disputed information
2. Contact the original data furnisher to verify the accuracy and completeness of this account
3. Provide me with documentation of your investigation method and findings
4. DELETE this account in its entirety if it cannot be fully verified with documentation

I am NOT requesting a simple "correction" or "update" to this account. The information is fundamentally inaccurate and unverifiable, and I am demanding its complete removal from my credit file.

You have 30 days from receipt of this letter to complete your investigation and respond in writing. Failure to investigate and respond within this timeframe, or continued reporting of unverifiable information, may result in legal action for willful non-compliance under 15 U.S.C. § 1681n, which provides for statutory damages of $100-$1,000 per violation plus punitive damages.

I expect a written response detailing the results of your investigation and confirmation of deletion.

Sincerely,

${params.clientData.name}
${params.clientData.address ? params.clientData.address : ''}
${params.clientData.city && params.clientData.state && params.clientData.zip ? `${params.clientData.city}, ${params.clientData.state} ${params.clientData.zip}` : ''}

Enclosures:
- Copy of identification
- Proof of address`;
}

export const DISPUTE_REASON_CODES = [
  { code: 'not_mine', label: 'Not My Account', description: 'This account does not belong to me' },
  { code: 'never_late', label: 'Never Late', description: 'Payment history is inaccurate' },
  { code: 'wrong_balance', label: 'Wrong Balance/Amount', description: 'Reported amounts are incorrect' },
  { code: 'closed_by_consumer', label: 'Closed by Consumer', description: 'Account closure reported incorrectly' },
  { code: 'obsolete', label: 'Obsolete (7+ Years)', description: 'Information exceeds reporting period' },
  { code: 'duplicate', label: 'Duplicate Entry', description: 'Account appears multiple times' },
  { code: 'paid_collection', label: 'Paid Collection', description: 'Paid but still reported as unpaid' },
  { code: 'identity_theft', label: 'Identity Theft', description: 'Fraudulent account' },
  { code: 'wrong_status', label: 'Wrong Status', description: 'Account status is inaccurate' },
  { code: 'wrong_dates', label: 'Wrong Dates', description: 'Dates are incorrect' },
  { code: 'mixed_file', label: 'Mixed File', description: 'Account belongs to another person' },
  { code: 'unauthorized_inquiry', label: 'Unauthorized Inquiry', description: 'Inquiry made without permission' },
];

export type { ClientInfo, NegativeItemInfo, GenerateLetterParams };

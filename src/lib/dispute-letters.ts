interface DisputeLetterData {
  clientName: string;
  clientAddress?: string;
  creditorName: string;
  accountNumber?: string;
  amount?: number;
  itemType: string;
  bureau: string;
  disputeReason: string;
  disputeType: string;
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

export function generateStandardDisputeLetter(data: DisputeLetterData): string {
  const bureauAddress = BUREAU_ADDRESSES[data.bureau.toLowerCase()] || BUREAU_ADDRESSES.transunion;
  
  return `${formatDate()}

${bureauAddress}

Re: Dispute of Inaccurate Information
${data.accountNumber ? `Account Number: ****${data.accountNumber.slice(-4)}` : ''}

To Whom It May Concern:

I am writing to dispute the following information in my credit file. The item I am disputing is inaccurate and incomplete, and I request that it be investigated and removed or corrected.

DISPUTED ITEM:
Creditor Name: ${data.creditorName}
${data.accountNumber ? `Account Number: ****${data.accountNumber.slice(-4)}` : ''}
Item Type: ${formatItemType(data.itemType)}
${data.amount ? `Amount: ${formatCurrency(data.amount)}` : ''}

REASON FOR DISPUTE:
${data.disputeReason}

Under the Fair Credit Reporting Act (FCRA), Section 611 (15 U.S.C. § 1681i), you are required to conduct a reasonable investigation into this disputed information within 30 days of receiving this letter. If the information cannot be verified, it must be deleted from my credit report.

Please investigate this matter and provide me with the results in writing. I also request that you send me a free copy of my credit report showing any corrections made as a result of this dispute.

I have enclosed copies of documents supporting my position. Please investigate this matter and delete or correct the disputed item as soon as possible.

Sincerely,

${data.clientName}

Enclosures:
- Copy of identification
- Supporting documentation`;
}

export function generateMethodOfVerificationLetter(data: DisputeLetterData): string {
  const bureauAddress = BUREAU_ADDRESSES[data.bureau.toLowerCase()] || BUREAU_ADDRESSES.transunion;
  
  return `${formatDate()}

${bureauAddress}

Re: Request for Method of Verification - Previously Disputed Item
${data.accountNumber ? `Account Number: ****${data.accountNumber.slice(-4)}` : ''}

To Whom It May Concern:

I previously disputed the following item on my credit report, and you indicated that it was "verified." I am now requesting, under Section 611(a)(7) of the Fair Credit Reporting Act (15 U.S.C. § 1681i), a detailed description of the procedure used to determine the accuracy of the disputed information.

ITEM IN QUESTION:
Creditor Name: ${data.creditorName}
${data.accountNumber ? `Account Number: ****${data.accountNumber.slice(-4)}` : ''}
Item Type: ${formatItemType(data.itemType)}
${data.amount ? `Amount: ${formatCurrency(data.amount)}` : ''}

ORIGINAL DISPUTE REASON:
${data.disputeReason}

Under the FCRA, I am entitled to know:
1. The method of verification used
2. The name, address, and telephone number of the furnisher contacted
3. The specific documents or information reviewed during the investigation

Please provide this information within 15 days of receipt of this letter. If you are unable to provide the method of verification, please delete this item from my credit report immediately.

Sincerely,

${data.clientName}`;
}

export function generateGoodwillLetter(data: DisputeLetterData): string {
  return `${formatDate()}

${data.creditorName}
Customer Service Department

Re: Goodwill Adjustment Request
${data.accountNumber ? `Account Number: ****${data.accountNumber.slice(-4)}` : ''}

Dear Sir or Madam:

I am writing to request a goodwill adjustment to remove a negative mark from my credit report associated with the above-referenced account.

ACCOUNT DETAILS:
Creditor Name: ${data.creditorName}
${data.accountNumber ? `Account Number: ****${data.accountNumber.slice(-4)}` : ''}
Item Type: ${formatItemType(data.itemType)}

EXPLANATION:
${data.disputeReason}

I understand that I was responsible for ensuring timely payments, and I take full accountability for this situation. However, I am requesting your consideration for a goodwill adjustment due to the circumstances I have described.

I have been a loyal customer and have since maintained a positive payment history. Removing this negative mark would significantly help me in achieving my financial goals, including [obtaining a mortgage/car loan/improving my credit score].

I would greatly appreciate your consideration of this request. If you are able to grant this goodwill adjustment, please update the credit bureaus to reflect the removal of this negative mark.

Thank you for your time and understanding. I look forward to continuing my positive relationship with your company.

Sincerely,

${data.clientName}`;
}

export function generateDirectCreditorLetter(data: DisputeLetterData): string {
  return `${formatDate()}

${data.creditorName}
Attn: Credit Dispute Department

Re: Direct Dispute of Reported Information
${data.accountNumber ? `Account Number: ****${data.accountNumber.slice(-4)}` : ''}

To Whom It May Concern:

I am writing to formally dispute information you have furnished to the credit reporting agencies regarding the above-referenced account. Under the Fair Credit Reporting Act (FCRA), Section 623 (15 U.S.C. § 1681s-2), you have a legal obligation to report accurate information.

DISPUTED INFORMATION:
Creditor Name: ${data.creditorName}
${data.accountNumber ? `Account Number: ****${data.accountNumber.slice(-4)}` : ''}
Item Type: ${formatItemType(data.itemType)}
${data.amount ? `Amount Reported: ${formatCurrency(data.amount)}` : ''}

REASON FOR DISPUTE:
${data.disputeReason}

I request that you:
1. Investigate this dispute immediately
2. Correct any inaccurate information with all credit bureaus
3. Provide me with documentation supporting your position if you believe the information is accurate

Under the FCRA, you must complete your investigation within 30 days and notify me of the results. If you cannot verify the accuracy of the disputed information, you must request deletion from all credit bureaus.

Please send your written response to the address above within 30 days.

Sincerely,

${data.clientName}`;
}

export function generateDisputeLetter(data: DisputeLetterData): string {
  switch (data.disputeType) {
    case 'method_of_verification':
      return generateMethodOfVerificationLetter(data);
    case 'goodwill':
      return generateGoodwillLetter(data);
    case 'direct_creditor':
      return generateDirectCreditorLetter(data);
    case 'standard':
    default:
      return generateStandardDisputeLetter(data);
  }
}

// PDF parsing utility - using pdf-parse v1.x simple API
async function parsePdf(buffer: Buffer): Promise<{ text: string; numpages: number }> {
  // Dynamic require to avoid build-time bundling issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse');
  const result = await pdfParse(buffer);
  return { text: result.text, numpages: result.numpages };
}

export interface ParsedCreditData {
  scores: {
    transunion?: number;
    experian?: number;
    equifax?: number;
  };
  accounts: ParsedAccount[];
  negativeItems: ParsedNegativeItem[];
  inquiries: ParsedInquiry[];
  summary: {
    totalAccounts: number;
    openAccounts: number;
    closedAccounts: number;
    totalDebt: number;
    totalCreditLimit: number;
    utilizationPercent: number;
  };
  rawText: string;
}

export interface ParsedAccount {
  creditorName: string;
  accountNumber?: string;
  accountType?: string;
  accountStatus?: string;
  balance?: number;
  creditLimit?: number;
  highCredit?: number;
  monthlyPayment?: number;
  pastDueAmount?: number;
  paymentStatus?: string;
  dateOpened?: Date;
  dateReported?: Date;
  bureau?: string;
  isNegative: boolean;
  riskLevel?: string;
  remarks?: string;
}

export interface ParsedNegativeItem {
  itemType: string;
  creditorName: string;
  originalCreditor?: string;
  amount?: number;
  dateReported?: Date;
  bureau?: string;
  riskSeverity: string;
}

export interface ParsedInquiry {
  creditorName: string;
  inquiryDate?: Date;
  bureau?: string;
}

const SCORE_PATTERNS = [
  /TransUnion[:\s]*(\d{3})/i,
  /Experian[:\s]*(\d{3})/i,
  /Equifax[:\s]*(\d{3})/i,
  /FICO[:\s]*Score[:\s]*(\d{3})/i,
  /VantageScore[:\s]*(\d{3})/i,
  /Credit\s*Score[:\s]*(\d{3})/i,
];

const NEGATIVE_KEYWORDS = [
  'collection',
  'charge-off',
  'chargeoff',
  'late payment',
  'delinquent',
  'past due',
  'bankruptcy',
  'foreclosure',
  'repossession',
  'judgment',
  'tax lien',
  'settled',
  'written off',
];

const ACCOUNT_TYPE_PATTERNS: Record<string, RegExp> = {
  credit_card: /credit\s*card|revolving|visa|mastercard|amex|discover/i,
  auto_loan: /auto|vehicle|car\s*loan/i,
  mortgage: /mortgage|home\s*loan|real\s*estate/i,
  personal_loan: /personal\s*loan|installment/i,
  student_loan: /student|education|loan/i,
  collection: /collection|collect/i,
};

export async function parsePdfCreditReport(buffer: Buffer): Promise<ParsedCreditData> {
  const data = await parsePdf(buffer);
  const text = data.text;
  
  const scores = extractScores(text);
  const accounts = extractAccounts(text);
  const negativeItems = extractNegativeItems(text, accounts);
  const inquiries = extractInquiries(text);
  const summary = calculateSummary(accounts);

  return {
    scores,
    accounts,
    negativeItems,
    inquiries,
    summary,
    rawText: text,
  };
}

function extractScores(text: string): ParsedCreditData['scores'] {
  const scores: ParsedCreditData['scores'] = {};
  
  // TransUnion
  const tuMatch = text.match(/TransUnion[:\s]*(\d{3})/i);
  if (tuMatch) scores.transunion = parseInt(tuMatch[1]);
  
  // Experian
  const exMatch = text.match(/Experian[:\s]*(\d{3})/i);
  if (exMatch) scores.experian = parseInt(exMatch[1]);
  
  // Equifax
  const eqMatch = text.match(/Equifax[:\s]*(\d{3})/i);
  if (eqMatch) scores.equifax = parseInt(eqMatch[1]);
  
  // Generic score if no specific bureau found
  if (!scores.transunion && !scores.experian && !scores.equifax) {
    const genericMatch = text.match(/(?:FICO|VantageScore|Credit\s*Score)[:\s]*(\d{3})/i);
    if (genericMatch) {
      const score = parseInt(genericMatch[1]);
      scores.transunion = score;
      scores.experian = score;
      scores.equifax = score;
    }
  }
  
  return scores;
}

function extractAccounts(text: string): ParsedAccount[] {
  const accounts: ParsedAccount[] = [];
  
  // Split text into potential account sections
  const sections = text.split(/(?=Account\s*(?:Name|#|Number)|Creditor|Trade\s*Line)/i);
  
  for (const section of sections) {
    if (section.length < 50) continue;
    
    const account = parseAccountSection(section);
    if (account && account.creditorName) {
      accounts.push(account);
    }
  }
  
  return accounts;
}

function parseAccountSection(section: string): ParsedAccount | null {
  // Extract creditor name
  const nameMatch = section.match(/(?:Account\s*Name|Creditor|Company)[:\s]*([A-Z][A-Za-z0-9\s&.,'-]+)/i);
  if (!nameMatch) return null;
  
  const creditorName = nameMatch[1].trim().substring(0, 100);
  if (creditorName.length < 2) return null;
  
  // Extract account number (masked)
  const accountNumMatch = section.match(/(?:Account\s*(?:#|Number|No))[:\s]*([X\d*-]+)/i);
  const accountNumber = accountNumMatch ? accountNumMatch[1] : undefined;
  
  // Extract balance
  const balanceMatch = section.match(/(?:Balance|Current\s*Balance|Amount\s*Owed)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i);
  const balance = balanceMatch ? Math.round(parseFloat(balanceMatch[1].replace(/,/g, '')) * 100) : undefined;
  
  // Extract credit limit
  const limitMatch = section.match(/(?:Credit\s*Limit|High\s*Credit|Limit)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i);
  const creditLimit = limitMatch ? Math.round(parseFloat(limitMatch[1].replace(/,/g, '')) * 100) : undefined;
  
  // Extract payment status
  let paymentStatus = 'current';
  if (/30\s*days?\s*(?:late|past\s*due)/i.test(section)) paymentStatus = '30_days_late';
  else if (/60\s*days?\s*(?:late|past\s*due)/i.test(section)) paymentStatus = '60_days_late';
  else if (/90\s*days?\s*(?:late|past\s*due)/i.test(section)) paymentStatus = '90_days_late';
  else if (/120\s*days?\s*(?:late|past\s*due)/i.test(section)) paymentStatus = '120_days_late';
  else if (/collection/i.test(section)) paymentStatus = 'collection';
  
  // Determine account type
  let accountType = 'other';
  for (const [type, pattern] of Object.entries(ACCOUNT_TYPE_PATTERNS)) {
    if (pattern.test(section)) {
      accountType = type;
      break;
    }
  }
  
  // Determine account status
  let accountStatus = 'open';
  if (/closed/i.test(section)) accountStatus = 'closed';
  else if (/collection/i.test(section)) accountStatus = 'collection';
  else if (/charge[\s-]*off/i.test(section)) accountStatus = 'charge_off';
  
  // Check if negative
  const isNegative = NEGATIVE_KEYWORDS.some(keyword => 
    section.toLowerCase().includes(keyword.toLowerCase())
  );
  
  // Determine risk level
  let riskLevel = 'low';
  if (accountStatus === 'collection' || accountStatus === 'charge_off') riskLevel = 'severe';
  else if (paymentStatus !== 'current') {
    if (paymentStatus === '120_days_late') riskLevel = 'severe';
    else if (paymentStatus === '90_days_late') riskLevel = 'high';
    else if (paymentStatus === '60_days_late') riskLevel = 'medium';
    else riskLevel = 'low';
  }
  
  return {
    creditorName,
    accountNumber,
    accountType,
    accountStatus,
    balance,
    creditLimit,
    paymentStatus,
    isNegative,
    riskLevel,
  };
}

function extractNegativeItems(text: string, accounts: ParsedAccount[]): ParsedNegativeItem[] {
  const negativeItems: ParsedNegativeItem[] = [];
  
  // Add negative items from accounts
  for (const account of accounts) {
    if (account.isNegative) {
      let itemType = 'derogatory';
      if (account.accountStatus === 'collection') itemType = 'collection';
      else if (account.accountStatus === 'charge_off') itemType = 'charge_off';
      else if (account.paymentStatus?.includes('late')) itemType = 'late_payment';
      
      negativeItems.push({
        itemType,
        creditorName: account.creditorName,
        amount: account.balance,
        riskSeverity: account.riskLevel || 'medium',
      });
    }
  }
  
  // Look for additional negative items in text
  const collectionMatches = text.matchAll(/(?:Collection|Collector)[:\s]*([A-Za-z0-9\s&.,'-]+)[\s\S]{0,200}?\$?([\d,]+(?:\.\d{2})?)/gi);
  for (const match of collectionMatches) {
    const creditorName = match[1].trim().substring(0, 100);
    const amount = match[2] ? Math.round(parseFloat(match[2].replace(/,/g, '')) * 100) : undefined;
    
    if (!negativeItems.some(item => item.creditorName.toLowerCase() === creditorName.toLowerCase())) {
      negativeItems.push({
        itemType: 'collection',
        creditorName,
        amount,
        riskSeverity: 'high',
      });
    }
  }
  
  return negativeItems;
}

function extractInquiries(text: string): ParsedInquiry[] {
  const inquiries: ParsedInquiry[] = [];
  
  const inquirySection = text.match(/(?:Inquiries|Credit\s*Inquiries)[\s\S]*?(?=Account|Trade|$)/i);
  if (!inquirySection) return inquiries;
  
  const inquiryMatches = inquirySection[0].matchAll(/([A-Z][A-Za-z0-9\s&.,'-]+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/g);
  for (const match of inquiryMatches) {
    inquiries.push({
      creditorName: match[1].trim(),
      inquiryDate: new Date(match[2]),
    });
  }
  
  return inquiries;
}

function calculateSummary(accounts: ParsedAccount[]): ParsedCreditData['summary'] {
  const openAccounts = accounts.filter(a => a.accountStatus === 'open');
  const closedAccounts = accounts.filter(a => a.accountStatus === 'closed');
  
  let totalDebt = 0;
  let totalCreditLimit = 0;
  
  for (const account of accounts) {
    if (account.balance) totalDebt += account.balance;
    if (account.creditLimit) totalCreditLimit += account.creditLimit;
  }
  
  const utilizationPercent = totalCreditLimit > 0 
    ? Math.round((totalDebt / totalCreditLimit) * 100) 
    : 0;
  
  return {
    totalAccounts: accounts.length,
    openAccounts: openAccounts.length,
    closedAccounts: closedAccounts.length,
    totalDebt,
    totalCreditLimit,
    utilizationPercent,
  };
}

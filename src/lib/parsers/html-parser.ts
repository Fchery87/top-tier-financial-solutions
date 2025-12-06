import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { ParsedCreditData, ParsedAccount, ParsedNegativeItem, ParsedInquiry } from './pdf-parser';
import { detectHtmlSource, type CreditReportSource, type SourceDetectionResult } from './detect-source';
import { parseIdentityIQReport } from './identityiq-parser';
import { parseSmartCreditReport } from './smartcredit-parser';
import { parsePrivacyGuardReport } from './privacyguard-parser';
import { parseMyScoreIQReport } from './myscoreiq-parser';
import { parseAnnualCreditReport } from './annualcreditreport-parser';
import { parseTransUnionReport } from './transunion-parser';
import { parseExperianReport } from './experian-parser';
import { parseEquifaxReport } from './equifax-parser';

export { type ParsedCreditData, type ParsedAccount, type ParsedNegativeItem, type ParsedInquiry };
export { type CreditReportSource, type SourceDetectionResult };

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

// Parser routing map
const SERVICE_PARSERS: Partial<Record<CreditReportSource, (html: string) => ParsedCreditData>> = {
  // Monitoring services
  identityiq: parseIdentityIQReport,
  smartcredit: parseSmartCreditReport,
  privacyguard: parsePrivacyGuardReport,
  myscoreiq: parseMyScoreIQReport,
  // Bureau-direct parsers
  annualcreditreport: parseAnnualCreditReport,
  transunion: parseTransUnionReport,
  experian: parseExperianReport,
  equifax: parseEquifaxReport,
};

export interface ParseResult extends ParsedCreditData {
  detectedSource: SourceDetectionResult;
}

/**
 * Main HTML credit report parser with automatic source detection and routing
 * Detects the monitoring service and routes to the appropriate specialized parser
 */
export function parseHtmlCreditReport(html: string): ParsedCreditData {
  // Detect the source service
  const detectionResult = detectHtmlSource(html);
  
  console.log(`[Credit Parser] Detected source: ${detectionResult.source} (confidence: ${detectionResult.confidence})`);
  
  // Route to specialized parser if available and confidence is sufficient
  if (detectionResult.confidence !== 'low' && SERVICE_PARSERS[detectionResult.source]) {
    try {
      const parser = SERVICE_PARSERS[detectionResult.source]!;
      const result = parser(html);
      
      // Add detection metadata
      return {
        ...result,
        detectedSource: detectionResult,
      } as ParsedCreditData;
    } catch (error) {
      console.warn(`[Credit Parser] Specialized parser failed, falling back to generic: ${error}`);
    }
  }
  
  // Fallback to generic parser
  return parseGenericHtmlReport(html, detectionResult);
}

/**
 * Parse with explicit source override (useful when user knows the source)
 */
export function parseHtmlWithSource(html: string, source: CreditReportSource): ParsedCreditData {
  const parser = SERVICE_PARSERS[source];
  if (parser) {
    return parser(html);
  }
  return parseGenericHtmlReport(html);
}

/**
 * Generic HTML parser - fallback for unknown or low-confidence sources
 */
function parseGenericHtmlReport(html: string, detectionResult?: SourceDetectionResult): ParsedCreditData {
  const $ = cheerio.load(html);
  const text = $.text();
  
  const scores = extractScores($, text);
  const accounts = extractAccounts($, text);
  const negativeItems = extractNegativeItems(accounts, text);
  const inquiries = extractInquiries($, text);
  const summary = calculateSummary(accounts);

  return {
    scores,
    accounts,
    negativeItems,
    inquiries,
    summary,
    rawText: text,
    detectedSource: detectionResult,
  } as ParsedCreditData;
}

function extractScores($: cheerio.CheerioAPI, text: string): ParsedCreditData['scores'] {
  const scores: ParsedCreditData['scores'] = {};
  
  // Try to find scores in structured elements
  $('[class*="score"], [id*="score"], [data-score]').each((_, el) => {
    const scoreText = $(el).text();
    const scoreMatch = scoreText.match(/(\d{3})/);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]);
      if (score >= 300 && score <= 850) {
        const parentText = $(el).parent().text().toLowerCase();
        if (parentText.includes('transunion')) scores.transunion = score;
        else if (parentText.includes('experian')) scores.experian = score;
        else if (parentText.includes('equifax')) scores.equifax = score;
      }
    }
  });
  
  // Fallback to text patterns
  if (!scores.transunion) {
    const tuMatch = text.match(/TransUnion[:\s]*(\d{3})/i);
    if (tuMatch) scores.transunion = parseInt(tuMatch[1]);
  }
  
  if (!scores.experian) {
    const exMatch = text.match(/Experian[:\s]*(\d{3})/i);
    if (exMatch) scores.experian = parseInt(exMatch[1]);
  }
  
  if (!scores.equifax) {
    const eqMatch = text.match(/Equifax[:\s]*(\d{3})/i);
    if (eqMatch) scores.equifax = parseInt(eqMatch[1]);
  }
  
  return scores;
}

function extractAccounts($: cheerio.CheerioAPI, text: string): ParsedAccount[] {
  const accounts: ParsedAccount[] = [];
  
  // Try to find account tables
  $('table').each((_, table) => {
    const tableText = $(table).text().toLowerCase();
    if (tableText.includes('account') || tableText.includes('creditor') || tableText.includes('balance')) {
      $(table).find('tr').each((_, row) => {
        const cells = $(row).find('td, th');
        if (cells.length >= 2) {
          const account = parseTableRow($, cells, tableText);
          if (account && account.creditorName) {
            accounts.push(account);
          }
        }
      });
    }
  });
  
  // Try to find account sections/divs
  $('[class*="account"], [class*="tradeline"], [id*="account"]').each((_, el) => {
    const sectionText = $(el).text();
    const account = parseAccountSection(sectionText);
    if (account && account.creditorName && !accounts.some(a => a.creditorName === account.creditorName)) {
      accounts.push(account);
    }
  });
  
  // Fallback to text parsing if no structured data found
  if (accounts.length === 0) {
    const sections = text.split(/(?=Account\s*(?:Name|#|Number)|Creditor|Trade\s*Line)/i);
    for (const section of sections) {
      if (section.length < 50) continue;
      const account = parseAccountSection(section);
      if (account && account.creditorName) {
        accounts.push(account);
      }
    }
  }
  
  return accounts;
}

function parseTableRow($: cheerio.CheerioAPI, cells: cheerio.Cheerio<AnyNode>, _contextText: string): ParsedAccount | null {
  const cellTexts = cells.map((_, cell) => $(cell).text().trim()).get();
  
  // Try to identify columns
  let creditorName = '';
  let balance: number | undefined;
  let creditLimit: number | undefined;
  let accountStatus = 'open';
  
  for (let i = 0; i < cellTexts.length; i++) {
    const text = cellTexts[i];
    
    // Skip header-like text
    if (/^(account|creditor|balance|limit|status|payment)/i.test(text)) continue;
    
    // Try to identify creditor name (usually first non-numeric cell)
    if (!creditorName && text.length > 2 && !/^\$?\d/.test(text)) {
      creditorName = text.substring(0, 100);
      continue;
    }
    
    // Try to identify monetary values
    const moneyMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)/);
    if (moneyMatch) {
      const value = Math.round(parseFloat(moneyMatch[1].replace(/,/g, '')) * 100);
      if (!balance) balance = value;
      else if (!creditLimit) creditLimit = value;
    }
    
    // Check for status indicators
    if (/closed/i.test(text)) accountStatus = 'closed';
    if (/collection/i.test(text)) accountStatus = 'collection';
    if (/charge[\s-]*off/i.test(text)) accountStatus = 'charge_off';
  }
  
  if (!creditorName) return null;
  
  const combinedText = cellTexts.join(' ');
  const isNegative = NEGATIVE_KEYWORDS.some(keyword => 
    combinedText.toLowerCase().includes(keyword.toLowerCase())
  );
  
  return {
    creditorName,
    balance,
    creditLimit,
    accountStatus,
    isNegative,
    riskLevel: isNegative ? (accountStatus === 'collection' ? 'severe' : 'medium') : 'low',
  };
}

function parseAccountSection(section: string): ParsedAccount | null {
  const nameMatch = section.match(/(?:Account\s*Name|Creditor|Company)[:\s]*([A-Z][A-Za-z0-9\s&.,'-]+)/i);
  if (!nameMatch) {
    // Try to get first capitalized word sequence
    const fallbackMatch = section.match(/^([A-Z][A-Za-z0-9\s&.,'-]{2,50})/);
    if (!fallbackMatch) return null;
  }
  
  const creditorName = (nameMatch ? nameMatch[1] : section.substring(0, 50)).trim();
  if (creditorName.length < 2) return null;
  
  const balanceMatch = section.match(/(?:Balance|Current\s*Balance|Amount)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i);
  const balance = balanceMatch ? Math.round(parseFloat(balanceMatch[1].replace(/,/g, '')) * 100) : undefined;
  
  const limitMatch = section.match(/(?:Credit\s*Limit|Limit|High\s*Credit)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i);
  const creditLimit = limitMatch ? Math.round(parseFloat(limitMatch[1].replace(/,/g, '')) * 100) : undefined;
  
  let accountStatus = 'open';
  if (/closed/i.test(section)) accountStatus = 'closed';
  else if (/collection/i.test(section)) accountStatus = 'collection';
  else if (/charge[\s-]*off/i.test(section)) accountStatus = 'charge_off';
  
  const isNegative = NEGATIVE_KEYWORDS.some(keyword => 
    section.toLowerCase().includes(keyword.toLowerCase())
  );
  
  return {
    creditorName,
    balance,
    creditLimit,
    accountStatus,
    isNegative,
    riskLevel: isNegative ? (accountStatus === 'collection' ? 'severe' : 'medium') : 'low',
  };
}

function extractNegativeItems(accounts: ParsedAccount[], _text: string): ParsedNegativeItem[] {
  const negativeItems: ParsedNegativeItem[] = [];
  
  for (const account of accounts) {
    if (account.isNegative) {
      let itemType = 'derogatory';
      if (account.accountStatus === 'collection') itemType = 'collection';
      else if (account.accountStatus === 'charge_off') itemType = 'charge_off';
      
      negativeItems.push({
        itemType,
        creditorName: account.creditorName,
        amount: account.balance,
        riskSeverity: account.riskLevel || 'medium',
      });
    }
  }
  
  return negativeItems;
}

function extractInquiries($: cheerio.CheerioAPI, _text: string): ParsedInquiry[] {
  const inquiries: ParsedInquiry[] = [];
  
  // Try to find inquiry section
  $('[class*="inquiry"], [id*="inquiry"]').each((_, el) => {
    const inquiryText = $(el).text();
    const matches = inquiryText.matchAll(/([A-Z][A-Za-z0-9\s&.,'-]+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/g);
    for (const match of matches) {
      inquiries.push({
        creditorName: match[1].trim(),
        inquiryDate: new Date(match[2]),
      });
    }
  });
  
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

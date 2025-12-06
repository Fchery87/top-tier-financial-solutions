// SmartCredit Credit Report Parser
// Handles HTML reports exported from SmartCredit monitoring service

import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { ParsedCreditData, ParsedAccount, ParsedNegativeItem, ParsedInquiry } from './pdf-parser';
import {
  StandardizedConsumerProfile,
  isAccountNegative,
  calculateRiskLevel,
  type StandardizedAccount,
} from './metro2-mapping';

// SmartCredit-specific CSS selectors
const SC_SELECTORS = {
  // Score sections - SmartCredit uses card-based layout
  scoreCard: '.score-card, .credit-score-card, [class*="scoreCard"], .sc-score',
  scoreValue: '.score-value, .score-num, [class*="scoreValue"]',
  scoreBureau: '.bureau-label, [class*="bureauName"]',
  
  // Account sections - SmartCredit typically uses accordion/expandable sections
  accountContainer: '.account-container, .tradeline-container, [class*="accountList"]',
  accountItem: '.account-item, .tradeline-item, [class*="accountItem"], [class*="tradelineRow"]',
  accountCard: '.account-card, [class*="accountCard"]',
  
  // Account detail fields
  creditorName: '.creditor, .account-name, [class*="creditorName"], [class*="companyName"]',
  accountNumber: '.acct-number, [class*="accountNumber"], [class*="acctNum"]',
  accountType: '.acct-type, [class*="accountType"]',
  accountStatus: '.acct-status, [class*="accountStatus"], [class*="status"]',
  balance: '.balance-amount, [class*="balance"], [class*="currentBalance"]',
  creditLimit: '.credit-limit, [class*="creditLimit"], [class*="limit"]',
  highCredit: '.high-credit, [class*="highCredit"]',
  dateOpened: '.date-opened, [class*="dateOpened"], [class*="openDate"]',
  dateReported: '.date-reported, [class*="lastReported"]',
  paymentHistory: '.payment-history, [class*="paymentHistory"]',
  
  // Consumer profile - SmartCredit shows this in a profile section
  profileSection: '.profile-section, .consumer-profile, [class*="personalInfo"]',
  nameField: '.consumer-name, [class*="fullName"]',
  addressBlock: '.address-block, [class*="address"]',
  
  // Inquiry section
  inquiryContainer: '.inquiry-container, [class*="inquiries"]',
  inquiryItem: '.inquiry-item, [class*="inquiryRow"]',
  
  // Collections/Negative - SmartCredit highlights these
  negativeContainer: '.negative-accounts, [class*="derogatory"], [class*="negative"]',
  collectionItem: '.collection-item, [class*="collection"]',
  
  // Bureau-specific sections
  bureauSection: '[data-bureau], [class*="bureau-section"]',
};

// SmartCredit text patterns
const SC_PATTERNS = {
  bureauScore: /(?:TransUnion|Experian|Equifax)[:\s]*Score[:\s]*(\d{3})/gi,
  vantageScore: /VantageScore[:\s]*3\.0[:\s]*(\d{3})/gi,
  accountNumber: /(?:Account|Acct)[:\s#]*([X\d*#-]+)/i,
  balance: /(?:Balance|Current|Owed)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  creditLimit: /(?:Limit|Credit\s*Line)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  paymentGrid: /(?:Payment\s*History|24.Month)[:\s]*([\dOKXCL\s-]+)/i,
};

export function parseSmartCreditReport(html: string): ParsedCreditData {
  const $ = cheerio.load(html);
  const text = $.text();

  const scores = extractSCScores($, text);
  const consumerProfile = extractSCConsumerProfile($, text);
  const accounts = extractSCAccounts($, text);
  const negativeItems = extractSCNegativeItems(accounts, $, text);
  const inquiries = extractSCInquiries($, text);
  const summary = calculateSCSummary(accounts);

  return {
    scores,
    accounts,
    negativeItems,
    inquiries,
    summary,
    rawText: text,
    consumerProfile,
  } as ParsedCreditData & { consumerProfile: StandardizedConsumerProfile };
}

function extractSCScores($: cheerio.CheerioAPI, text: string): ParsedCreditData['scores'] {
  const scores: ParsedCreditData['scores'] = {};

  // SmartCredit often shows scores in card format
  $(SC_SELECTORS.scoreCard).each((_, card) => {
    const cardEl = $(card);
    const scoreText = cardEl.find(SC_SELECTORS.scoreValue).text() || cardEl.text();
    const bureauText = cardEl.find(SC_SELECTORS.scoreBureau).text() || cardEl.attr('data-bureau') || '';
    
    const scoreMatch = scoreText.match(/(\d{3})/);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]);
      if (score >= 300 && score <= 850) {
        assignScoreToBureau(scores, bureauText, score);
      }
    }
  });

  // Fallback to text patterns
  const bureauMatches = text.matchAll(/(?:TransUnion|Experian|Equifax)[:\s]*(?:Score)?[:\s]*(\d{3})/gi);
  for (const match of bureauMatches) {
    const bureau = match[0].toLowerCase();
    const score = parseInt(match[1]);
    if (score >= 300 && score <= 850) {
      if (bureau.includes('transunion') && !scores.transunion) scores.transunion = score;
      else if (bureau.includes('experian') && !scores.experian) scores.experian = score;
      else if (bureau.includes('equifax') && !scores.equifax) scores.equifax = score;
    }
  }

  return scores;
}

function extractSCConsumerProfile($: cheerio.CheerioAPI, text: string): StandardizedConsumerProfile {
  const profile: StandardizedConsumerProfile = {
    names: [],
    addresses: [],
    employers: [],
  };

  // Extract from profile section
  $(SC_SELECTORS.profileSection).each((_, section) => {
    const sectionEl = $(section);
    
    // Names
    sectionEl.find(SC_SELECTORS.nameField).each((_, el) => {
      const nameText = $(el).text().trim();
      if (nameText.length > 2) {
        const parts = nameText.split(/\s+/);
        profile.names.push({
          firstName: parts[0] || '',
          middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined,
          lastName: parts[parts.length - 1] || '',
          bureau: getBureauFromContext($, el),
        });
      }
    });

    // Addresses
    sectionEl.find(SC_SELECTORS.addressBlock).each((_, el) => {
      const addressText = $(el).text().trim();
      const parsed = parseAddressText(addressText);
      if (parsed) {
        profile.addresses.push({
          ...parsed,
          bureau: getBureauFromContext($, el),
        });
      }
    });
  });

  // Extract SSN
  const ssnMatch = text.match(/(?:SSN|Social)[:\s]*(?:XXX-XX-)?(\d{4})/i);
  if (ssnMatch) profile.ssnLast4 = ssnMatch[1];

  // Extract DOB
  const dobMatch = text.match(/(?:DOB|Birth)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
  if (dobMatch) profile.dateOfBirth = parseDate(dobMatch[1]);

  return profile;
}

function extractSCAccounts($: cheerio.CheerioAPI, text: string): ParsedAccount[] {
  const accounts: ParsedAccount[] = [];
  const seen = new Set<string>();

  // Primary: Card/Item based extraction
  $(`${SC_SELECTORS.accountItem}, ${SC_SELECTORS.accountCard}`).each((_, el) => {
    const account = parseAccountElement($, el as Element);
    if (account && account.creditorName) {
      const key = normalizeKey(account.creditorName, account.accountNumber);
      if (!seen.has(key)) {
        seen.add(key);
        accounts.push(account);
      }
    }
  });

  // Secondary: Container-based with children
  if (accounts.length === 0) {
    $(SC_SELECTORS.accountContainer).children().each((_, el) => {
      const account = parseAccountElement($, el as Element);
      if (account && account.creditorName) {
        const key = normalizeKey(account.creditorName, account.accountNumber);
        if (!seen.has(key)) {
          seen.add(key);
          accounts.push(account);
        }
      }
    });
  }

  // Fallback: Text-based extraction
  if (accounts.length === 0) {
    const textAccounts = extractAccountsFromText(text);
    accounts.push(...textAccounts);
  }

  return accounts;
}

function parseAccountElement($: cheerio.CheerioAPI, el: Element): ParsedAccount | null {
  const elQuery = $(el);
  const elText = elQuery.text();

  // Get creditor name
  let creditorName = elQuery.find(SC_SELECTORS.creditorName).first().text().trim();
  if (!creditorName) {
    creditorName = elQuery.find('strong, b, .title, h3, h4').first().text().trim();
  }
  if (!creditorName || creditorName.length < 2 || creditorName.length > 100) return null;

  // Extract fields
  const accountNumber = getFieldText(elQuery, SC_SELECTORS.accountNumber) || 
    elText.match(SC_PATTERNS.accountNumber)?.[1];
  
  const balanceText = getFieldText(elQuery, SC_SELECTORS.balance) || 
    elText.match(SC_PATTERNS.balance)?.[1];
  const balance = parseMoneyValue(balanceText);

  const limitText = getFieldText(elQuery, SC_SELECTORS.creditLimit) ||
    elText.match(SC_PATTERNS.creditLimit)?.[1];
  const creditLimit = parseMoneyValue(limitText);

  const statusText = getFieldText(elQuery, SC_SELECTORS.accountStatus) || elText;
  const typeText = getFieldText(elQuery, SC_SELECTORS.accountType);
  
  const dateOpenedText = getFieldText(elQuery, SC_SELECTORS.dateOpened);
  const dateReportedText = getFieldText(elQuery, SC_SELECTORS.dateReported);

  const account: ParsedAccount = {
    creditorName,
    accountNumber: accountNumber || undefined,
    accountType: typeText || determineAccountType(elText),
    accountStatus: determineStatus(statusText),
    balance,
    creditLimit,
    paymentStatus: determinePaymentStatus(statusText),
    dateOpened: parseDate(dateOpenedText),
    dateReported: parseDate(dateReportedText),
    isNegative: false,
    riskLevel: 'low',
  };

  account.isNegative = isAccountNegative(account as Partial<StandardizedAccount>);
  account.riskLevel = calculateRiskLevel(account as Partial<StandardizedAccount>);

  return account;
}

function extractSCNegativeItems(accounts: ParsedAccount[], $: cheerio.CheerioAPI, _text: string): ParsedNegativeItem[] {
  const negativeItems: ParsedNegativeItem[] = [];

  // From accounts
  for (const account of accounts) {
    if (account.isNegative) {
      negativeItems.push({
        itemType: determineNegativeItemType(account),
        creditorName: account.creditorName,
        amount: account.balance,
        dateReported: account.dateReported,
        riskSeverity: account.riskLevel || 'medium',
      });
    }
  }

  // From dedicated negative sections
  $(SC_SELECTORS.negativeContainer).find(SC_SELECTORS.collectionItem + ', .item').each((_, el) => {
    const elText = $(el).text();
    const nameMatch = elText.match(/([A-Z][A-Za-z0-9\s&.,'-]{2,50})/);
    const amountMatch = elText.match(/\$?([\d,]+(?:\.\d{2})?)/);

    if (nameMatch) {
      const creditorName = nameMatch[1].trim();
      if (!negativeItems.some(n => n.creditorName.toLowerCase() === creditorName.toLowerCase())) {
        negativeItems.push({
          itemType: 'collection',
          creditorName,
          amount: amountMatch ? parseMoneyValue(amountMatch[1]) : undefined,
          riskSeverity: 'high',
        });
      }
    }
  });

  return negativeItems;
}

function extractSCInquiries($: cheerio.CheerioAPI, text: string): ParsedInquiry[] {
  const inquiries: ParsedInquiry[] = [];

  $(SC_SELECTORS.inquiryContainer).find(SC_SELECTORS.inquiryItem + ', tr, .item').each((_, el) => {
    const elText = $(el).text();
    const nameMatch = elText.match(/([A-Z][A-Za-z0-9\s&.,'-]+)/);
    const dateMatch = elText.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);

    if (nameMatch) {
      inquiries.push({
        creditorName: nameMatch[1].trim(),
        inquiryDate: dateMatch ? parseDate(dateMatch[1]) : undefined,
      });
    }
  });

  // Text fallback
  if (inquiries.length === 0) {
    const section = text.match(/(?:Inquiries|Hard\s*Inquiries)[\s\S]*?(?=Account|Tradeline|Public|$)/i);
    if (section) {
      const matches = section[0].matchAll(/([A-Z][A-Za-z0-9\s&.,'-]+)\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g);
      for (const match of matches) {
        inquiries.push({
          creditorName: match[1].trim(),
          inquiryDate: parseDate(match[2]),
        });
      }
    }
  }

  return inquiries;
}

function calculateSCSummary(accounts: ParsedAccount[]): ParsedCreditData['summary'] {
  const open = accounts.filter(a => a.accountStatus === 'open');
  const closed = accounts.filter(a => a.accountStatus === 'closed');

  let totalDebt = 0;
  let totalLimit = 0;

  for (const acc of accounts) {
    if (acc.balance) totalDebt += acc.balance;
    if (acc.creditLimit) totalLimit += acc.creditLimit;
  }

  return {
    totalAccounts: accounts.length,
    openAccounts: open.length,
    closedAccounts: closed.length,
    totalDebt,
    totalCreditLimit: totalLimit,
    utilizationPercent: totalLimit > 0 ? Math.round((totalDebt / totalLimit) * 100) : 0,
  };
}

// Helper functions
function assignScoreToBureau(scores: ParsedCreditData['scores'], bureauText: string, score: number) {
  const lower = bureauText.toLowerCase();
  if (lower.includes('transunion') || lower.includes('tu')) scores.transunion = score;
  else if (lower.includes('experian') || lower.includes('ex')) scores.experian = score;
  else if (lower.includes('equifax') || lower.includes('eq')) scores.equifax = score;
}

function getBureauFromContext($: cheerio.CheerioAPI, el: Element): 'transunion' | 'experian' | 'equifax' {
  const ctx = $(el).parents('[data-bureau]').first().attr('data-bureau') || 
    $(el).closest(SC_SELECTORS.bureauSection).text().toLowerCase();
  if (ctx.includes('transunion')) return 'transunion';
  if (ctx.includes('experian')) return 'experian';
  if (ctx.includes('equifax')) return 'equifax';
  return 'transunion';
}

function getFieldText(el: cheerio.Cheerio<AnyNode>, selector: string): string {
  return el.find(selector).first().text().trim();
}

function normalizeKey(creditor: string, accountNum?: string): string {
  return `${creditor.toLowerCase().replace(/\s+/g, '')}-${accountNum || ''}`;
}

function parseMoneyValue(val: string | undefined | null): number | undefined {
  if (!val) return undefined;
  const num = parseFloat(val.replace(/[$,]/g, ''));
  return isNaN(num) ? undefined : Math.round(num * 100);
}

function parseDate(str: string | undefined | null): Date | undefined {
  if (!str) return undefined;
  const d = new Date(str.replace(/-/g, '/'));
  return isNaN(d.getTime()) ? undefined : d;
}

function parseAddressText(text: string): { street: string; city: string; state: string; zipCode: string } | null {
  const match = text.match(/(.+?),\s*(.+?),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/i);
  if (match) {
    return { street: match[1].trim(), city: match[2].trim(), state: match[3].toUpperCase(), zipCode: match[4] };
  }
  return null;
}

function determineStatus(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('closed')) return 'closed';
  if (t.includes('collection')) return 'collection';
  if (t.includes('charge') && t.includes('off')) return 'charge_off';
  if (t.includes('paid')) return 'paid';
  return 'open';
}

function determinePaymentStatus(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('180')) return '180_days_late';
  if (t.includes('150')) return '150_days_late';
  if (t.includes('120')) return '120_days_late';
  if (t.includes('90')) return '90_days_late';
  if (t.includes('60')) return '60_days_late';
  if (t.includes('30')) return '30_days_late';
  if (t.includes('collection')) return 'collection';
  if (t.includes('charge')) return 'charge_off';
  return 'current';
}

function determineAccountType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('credit card') || t.includes('revolving')) return 'credit_card';
  if (t.includes('auto') || t.includes('vehicle')) return 'auto_loan';
  if (t.includes('mortgage')) return 'mortgage';
  if (t.includes('student')) return 'student_loan';
  if (t.includes('collection')) return 'collection';
  return 'other';
}

function determineNegativeItemType(account: ParsedAccount): string {
  if (account.accountStatus === 'collection') return 'collection';
  if (account.accountStatus === 'charge_off') return 'charge_off';
  if (account.paymentStatus?.includes('late')) return 'late_payment';
  return 'derogatory';
}

function extractAccountsFromText(text: string): ParsedAccount[] {
  const accounts: ParsedAccount[] = [];
  const sections = text.split(/(?=(?:Account|Creditor|Trade\s*Line)[:\s])/i);

  for (const section of sections) {
    if (section.length < 40) continue;
    const nameMatch = section.match(/(?:Account|Creditor|Company)[:\s]*([A-Z][A-Za-z0-9\s&.,'-]+)/i);
    if (!nameMatch) continue;

    const creditorName = nameMatch[1].trim().substring(0, 100);
    if (creditorName.length < 2) continue;

    const account: ParsedAccount = {
      creditorName,
      accountNumber: section.match(SC_PATTERNS.accountNumber)?.[1],
      balance: parseMoneyValue(section.match(SC_PATTERNS.balance)?.[1]),
      creditLimit: parseMoneyValue(section.match(SC_PATTERNS.creditLimit)?.[1]),
      accountStatus: determineStatus(section),
      paymentStatus: determinePaymentStatus(section),
      isNegative: false,
      riskLevel: 'low',
    };

    account.isNegative = isAccountNegative(account as Partial<StandardizedAccount>);
    account.riskLevel = calculateRiskLevel(account as Partial<StandardizedAccount>);
    accounts.push(account);
  }

  return accounts;
}

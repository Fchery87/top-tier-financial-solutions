// IdentityIQ Credit Report Parser
// Handles HTML reports exported from IdentityIQ credit monitoring service

import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { ParsedCreditData, ParsedAccount, ParsedNegativeItem, ParsedInquiry } from './pdf-parser';
import {
  StandardizedAccount,
  StandardizedConsumerProfile,
  mapAccountTypeToCategory,
  calculateCompletenessScore,
  isAccountNegative,
  calculateRiskLevel,
  calculateFcraComplianceDate,
} from './metro2-mapping';

// IdentityIQ-specific CSS selectors and patterns
const IIQ_SELECTORS = {
  // Score sections
  scoreContainer: '.score-container, .credit-score, [class*="score"], .iq-score',
  scoreValue: '.score-value, .score-number, [class*="score-val"]',
  scoreBureau: '.bureau-name, .score-bureau, [class*="bureau"]',
  
  // Account/Tradeline sections
  accountSection: '.tradeline, .account-item, .credit-account, [class*="tradeline"], [class*="account-row"]',
  accountTable: 'table.accounts, table.tradelines, table[class*="account"]',
  accountRow: 'tr.account, tr.tradeline, tr[class*="account"]',
  
  // Account details
  creditorName: '.creditor-name, .account-name, .company-name, td:first-child',
  accountNumber: '.account-number, .acct-num, [class*="account-num"]',
  accountType: '.account-type, .acct-type, [class*="type"]',
  accountStatus: '.account-status, .status, [class*="status"]',
  balance: '.balance, .current-balance, [class*="balance"]',
  creditLimit: '.credit-limit, .limit, [class*="limit"]',
  highCredit: '.high-credit, .high-balance, [class*="high"]',
  payment: '.payment, .monthly-payment, [class*="payment"]',
  dateOpened: '.date-opened, .open-date, [class*="opened"]',
  dateReported: '.date-reported, .last-reported, [class*="reported"]',
  paymentStatus: '.payment-status, .pay-status, [class*="pay-status"]',
  
  // Consumer profile
  consumerSection: '.consumer-info, .personal-info, [class*="consumer"], [class*="personal"]',
  nameField: '.consumer-name, .full-name, [class*="name"]',
  addressField: '.address, [class*="address"]',
  ssnField: '.ssn, [class*="ssn"]',
  dobField: '.dob, .date-of-birth, [class*="birth"]',
  
  // Inquiry sections
  inquirySection: '.inquiries, .inquiry-section, [class*="inquiry"]',
  inquiryItem: '.inquiry-item, .inquiry-row, tr[class*="inquiry"]',
  
  // Negative items / Derogatory
  negativeSection: '.negative-items, .derogatory, [class*="negative"], [class*="derogatory"]',
  collectionSection: '.collections, [class*="collection"]',
  
  // Public records
  publicRecordSection: '.public-records, [class*="public-record"]',
};

// Common IdentityIQ text patterns
const IIQ_PATTERNS = {
  bureauScore: /(?:TransUnion|Experian|Equifax)[:\s]*(\d{3})/gi,
  accountNumber: /(?:Account\s*(?:#|Number|No\.?)[:\s]*)([X\d*#-]+)/i,
  balance: /(?:Balance|Current\s*Balance|Amount\s*Owed)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  creditLimit: /(?:Credit\s*Limit|Limit|High\s*Credit)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  dateOpened: /(?:Date\s*Opened|Opened|Open\s*Date)[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  dateReported: /(?:Date\s*Reported|Last\s*Reported|Reported)[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  paymentHistoryGrid: /Payment\s*History[:\s]*([\d\sOKXL-]+)/i,
};

export function parseIdentityIQReport(html: string): ParsedCreditData {
  const $ = cheerio.load(html);
  const text = $.text();

  const scores = extractIIQScores($, text);
  const consumerProfile = extractIIQConsumerProfile($, text);
  const accounts = extractIIQAccounts($, text);
  const negativeItems = extractIIQNegativeItems(accounts, $, text);
  const inquiries = extractIIQInquiries($, text);
  const summary = calculateIIQSummary(accounts);

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

function extractIIQScores($: cheerio.CheerioAPI, text: string): ParsedCreditData['scores'] {
  const scores: ParsedCreditData['scores'] = {};

  // Try structured elements first
  $(IIQ_SELECTORS.scoreContainer).each((_, container) => {
    const containerEl = $(container);
    const scoreText = containerEl.find(IIQ_SELECTORS.scoreValue).text() || containerEl.text();
    const bureauText = containerEl.find(IIQ_SELECTORS.scoreBureau).text() || containerEl.closest('[class*="bureau"]').text();
    
    const scoreMatch = scoreText.match(/(\d{3})/);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]);
      if (score >= 300 && score <= 850) {
        const bureauLower = bureauText.toLowerCase();
        if (bureauLower.includes('transunion') || bureauLower.includes('tu')) {
          scores.transunion = score;
        } else if (bureauLower.includes('experian') || bureauLower.includes('ex')) {
          scores.experian = score;
        } else if (bureauLower.includes('equifax') || bureauLower.includes('eq')) {
          scores.equifax = score;
        }
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

function extractIIQConsumerProfile($: cheerio.CheerioAPI, text: string): StandardizedConsumerProfile {
  const profile: StandardizedConsumerProfile = {
    names: [],
    addresses: [],
    employers: [],
  };

  // Extract names from consumer section
  $(IIQ_SELECTORS.consumerSection).find(IIQ_SELECTORS.nameField).each((_, el) => {
    const nameText = $(el).text().trim();
    const nameParts = parseFullName(nameText);
    if (nameParts.lastName) {
      profile.names.push({
        ...nameParts,
        bureau: detectBureauFromContext($, el),
      });
    }
  });

  // Extract addresses
  $(IIQ_SELECTORS.consumerSection).find(IIQ_SELECTORS.addressField).each((_, el) => {
    const addressText = $(el).text().trim();
    const address = parseAddress(addressText);
    if (address) {
      profile.addresses.push({
        ...address,
        bureau: detectBureauFromContext($, el),
      });
    }
  });

  // Extract SSN last 4
  const ssnMatch = text.match(/SSN[:\s]*(?:XXX-XX-)?(\d{4})/i);
  if (ssnMatch) {
    profile.ssnLast4 = ssnMatch[1];
  }

  // Extract DOB
  const dobMatch = text.match(/(?:DOB|Date\s*of\s*Birth|Birth\s*Date)[:\s]*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (dobMatch) {
    profile.dateOfBirth = parseDate(dobMatch[1]);
  }

  return profile;
}

function extractIIQAccounts($: cheerio.CheerioAPI, text: string): ParsedAccount[] {
  const accounts: ParsedAccount[] = [];
  const processedCreditors = new Set<string>();

  // Try table-based extraction first
  $(IIQ_SELECTORS.accountTable).each((_, table) => {
    const headers = extractTableHeaders($, table);
    
    $(table).find('tbody tr, tr').each((_, row) => {
      if ($(row).find('th').length > 0) return; // Skip header rows
      
      const account = parseAccountFromTableRow($, row, headers);
      if (account && account.creditorName) {
        const key = `${account.creditorName}-${account.accountNumber || ''}`;
        if (!processedCreditors.has(key)) {
          processedCreditors.add(key);
          accounts.push(account);
        }
      }
    });
  });

  // Try div/section-based extraction
  $(IIQ_SELECTORS.accountSection).each((_, section) => {
    const account = parseAccountFromSection($, section);
    if (account && account.creditorName) {
      const key = `${account.creditorName}-${account.accountNumber || ''}`;
      if (!processedCreditors.has(key)) {
        processedCreditors.add(key);
        accounts.push(account);
      }
    }
  });

  // Fallback to text-based extraction if no structured data found
  if (accounts.length === 0) {
    const textAccounts = extractAccountsFromText(text);
    accounts.push(...textAccounts);
  }

  return accounts;
}

function extractTableHeaders($: cheerio.CheerioAPI, table: AnyNode): Map<string, number> {
  const headers = new Map<string, number>();
  const headerRow = $(table).find('thead tr, tr:first-child').first();
  
  headerRow.find('th, td').each((index, cell) => {
    const headerText = $(cell).text().trim().toLowerCase();
    
    if (headerText.includes('creditor') || headerText.includes('company') || headerText.includes('name')) {
      headers.set('creditorName', index);
    } else if (headerText.includes('account') && headerText.includes('number')) {
      headers.set('accountNumber', index);
    } else if (headerText.includes('type')) {
      headers.set('accountType', index);
    } else if (headerText.includes('status')) {
      headers.set('status', index);
    } else if (headerText.includes('balance')) {
      headers.set('balance', index);
    } else if (headerText.includes('limit')) {
      headers.set('creditLimit', index);
    } else if (headerText.includes('opened')) {
      headers.set('dateOpened', index);
    } else if (headerText.includes('reported')) {
      headers.set('dateReported', index);
    } else if (headerText.includes('payment')) {
      headers.set('paymentStatus', index);
    }
  });

  return headers;
}

function parseAccountFromTableRow($: cheerio.CheerioAPI, row: AnyNode, headers: Map<string, number>): ParsedAccount | null {
  const cells = $(row).find('td');
  if (cells.length < 2) return null;

  const getCellText = (key: string): string => {
    const index = headers.get(key);
    if (index !== undefined && cells[index]) {
      return $(cells[index]).text().trim();
    }
    return '';
  };

  const creditorName = getCellText('creditorName') || $(cells[0]).text().trim();
  if (!creditorName || creditorName.length < 2) return null;

  const balanceText = getCellText('balance');
  const limitText = getCellText('creditLimit');
  const statusText = getCellText('status');
  const paymentStatusText = getCellText('paymentStatus');

  const balance = parseMoneyValue(balanceText);
  const creditLimit = parseMoneyValue(limitText);
  const dateOpened = parseDate(getCellText('dateOpened'));
  const dateReported = parseDate(getCellText('dateReported'));

  const accountStatus = determineAccountStatus(statusText);
  const paymentStatus = determinePaymentStatus(paymentStatusText || statusText);
  const accountType = getCellText('accountType') || 'other';

  const account: ParsedAccount = {
    creditorName: creditorName.substring(0, 100),
    accountNumber: getCellText('accountNumber') || undefined,
    accountType,
    accountStatus,
    balance,
    creditLimit,
    paymentStatus,
    dateOpened,
    dateReported,
    isNegative: false,
    riskLevel: 'low',
  };

  // Calculate negative status and risk
  account.isNegative = isAccountNegative(account as unknown as Partial<StandardizedAccount>);
  account.riskLevel = calculateRiskLevel(account as unknown as Partial<StandardizedAccount>);

  return account;
}

function parseAccountFromSection($: cheerio.CheerioAPI, section: AnyNode): ParsedAccount | null {
  const sectionEl = $(section);
  const sectionText = sectionEl.text();

  // Extract creditor name
  const creditorEl = sectionEl.find(IIQ_SELECTORS.creditorName).first();
  let creditorName = creditorEl.length ? creditorEl.text().trim() : '';
  
  if (!creditorName) {
    // Try to get first strong/bold text or heading
    const headingEl = sectionEl.find('strong, b, h3, h4, .title').first();
    creditorName = headingEl.text().trim();
  }
  
  if (!creditorName || creditorName.length < 2) return null;

  // Extract other fields
  const accountNumber = extractFieldValue(sectionEl, IIQ_SELECTORS.accountNumber, sectionText, IIQ_PATTERNS.accountNumber);
  const balance = parseMoneyValue(extractFieldValue(sectionEl, IIQ_SELECTORS.balance, sectionText, IIQ_PATTERNS.balance));
  const creditLimit = parseMoneyValue(extractFieldValue(sectionEl, IIQ_SELECTORS.creditLimit, sectionText, IIQ_PATTERNS.creditLimit));
  const dateOpenedStr = extractFieldValue(sectionEl, IIQ_SELECTORS.dateOpened, sectionText, IIQ_PATTERNS.dateOpened);
  const dateReportedStr = extractFieldValue(sectionEl, IIQ_SELECTORS.dateReported, sectionText, IIQ_PATTERNS.dateReported);

  const statusText = sectionEl.find(IIQ_SELECTORS.accountStatus).text() || '';
  const paymentStatusText = sectionEl.find(IIQ_SELECTORS.paymentStatus).text() || statusText;

  const account: ParsedAccount = {
    creditorName: creditorName.substring(0, 100),
    accountNumber: accountNumber || undefined,
    accountType: sectionEl.find(IIQ_SELECTORS.accountType).text().trim() || 'other',
    accountStatus: determineAccountStatus(statusText || sectionText),
    balance,
    creditLimit,
    paymentStatus: determinePaymentStatus(paymentStatusText || sectionText),
    dateOpened: parseDate(dateOpenedStr),
    dateReported: parseDate(dateReportedStr),
    isNegative: false,
    riskLevel: 'low',
  };

  account.isNegative = isAccountNegative(account as unknown as Partial<StandardizedAccount>);
  account.riskLevel = calculateRiskLevel(account as unknown as Partial<StandardizedAccount>);

  return account;
}

function extractAccountsFromText(text: string): ParsedAccount[] {
  const accounts: ParsedAccount[] = [];
  
  // Split by common account delimiters
  const sections = text.split(/(?=(?:Account\s*(?:Name|#|Number)|Creditor|Trade\s*Line)[:\s])/i);
  
  for (const section of sections) {
    if (section.length < 50) continue;
    
    const creditorMatch = section.match(/(?:Account\s*Name|Creditor|Company)[:\s]*([A-Z][A-Za-z0-9\s&.,'-]+)/i);
    if (!creditorMatch) continue;
    
    const creditorName = creditorMatch[1].trim().substring(0, 100);
    if (creditorName.length < 2) continue;

    const account: ParsedAccount = {
      creditorName,
      accountNumber: section.match(IIQ_PATTERNS.accountNumber)?.[1],
      balance: parseMoneyValue(section.match(IIQ_PATTERNS.balance)?.[1]),
      creditLimit: parseMoneyValue(section.match(IIQ_PATTERNS.creditLimit)?.[1]),
      dateOpened: parseDate(section.match(IIQ_PATTERNS.dateOpened)?.[1]),
      dateReported: parseDate(section.match(IIQ_PATTERNS.dateReported)?.[1]),
      accountStatus: determineAccountStatus(section),
      paymentStatus: determinePaymentStatus(section),
      isNegative: false,
      riskLevel: 'low',
    };

    account.isNegative = isAccountNegative(account as unknown as Partial<StandardizedAccount>);
    account.riskLevel = calculateRiskLevel(account as unknown as Partial<StandardizedAccount>);

    accounts.push(account);
  }

  return accounts;
}

function extractIIQNegativeItems(accounts: ParsedAccount[], $: cheerio.CheerioAPI, text: string): ParsedNegativeItem[] {
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
        dateReported: account.dateReported,
        riskSeverity: account.riskLevel || 'medium',
      });
    }
  }

  // Look for additional collections in dedicated sections
  $(IIQ_SELECTORS.collectionSection).find('.collection-item, tr').each((_, el) => {
    const elText = $(el).text();
    const creditorMatch = elText.match(/([A-Z][A-Za-z0-9\s&.,'-]+)/);
    const amountMatch = elText.match(/\$?([\d,]+(?:\.\d{2})?)/);
    
    if (creditorMatch) {
      const creditorName = creditorMatch[1].trim().substring(0, 100);
      if (!negativeItems.some(item => item.creditorName.toLowerCase() === creditorName.toLowerCase())) {
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

function extractIIQInquiries($: cheerio.CheerioAPI, text: string): ParsedInquiry[] {
  const inquiries: ParsedInquiry[] = [];

  $(IIQ_SELECTORS.inquirySection).find(IIQ_SELECTORS.inquiryItem + ', tr').each((_, el) => {
    const elText = $(el).text();
    const creditorMatch = elText.match(/([A-Z][A-Za-z0-9\s&.,'-]+)/);
    const dateMatch = elText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
    
    if (creditorMatch) {
      inquiries.push({
        creditorName: creditorMatch[1].trim(),
        inquiryDate: dateMatch ? parseDate(dateMatch[1]) : undefined,
      });
    }
  });

  // Fallback to text extraction
  if (inquiries.length === 0) {
    const inquirySection = text.match(/(?:Inquiries|Credit\s*Inquiries)[\s\S]*?(?=Account|Trade|Public|$)/i);
    if (inquirySection) {
      const matches = inquirySection[0].matchAll(/([A-Z][A-Za-z0-9\s&.,'-]+)\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/g);
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

function calculateIIQSummary(accounts: ParsedAccount[]): ParsedCreditData['summary'] {
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

// Helper functions
function extractFieldValue(el: cheerio.Cheerio<AnyNode>, selector: string, text: string, pattern: RegExp): string {
  const selectorResult = el.find(selector).text().trim();
  if (selectorResult) return selectorResult;
  
  const patternMatch = text.match(pattern);
  return patternMatch ? patternMatch[1] : '';
}

function parseMoneyValue(value: string | undefined | null): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[$,]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return undefined;
  return Math.round(parsed * 100); // Store as cents
}

function parseDate(dateStr: string | undefined | null): Date | undefined {
  if (!dateStr) return undefined;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? undefined : date;
}

function parseFullName(fullName: string): { firstName: string; middleName?: string; lastName: string; suffix?: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
  
  const suffixes = ['JR', 'SR', 'II', 'III', 'IV'];
  let suffix: string | undefined;
  let lastName = parts[parts.length - 1];
  
  if (suffixes.includes(lastName.toUpperCase().replace(/\./g, ''))) {
    suffix = lastName;
    lastName = parts[parts.length - 2];
    return {
      firstName: parts[0],
      middleName: parts.length > 3 ? parts.slice(1, -2).join(' ') : undefined,
      lastName,
      suffix,
    };
  }
  
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(' '),
    lastName,
  };
}

function parseAddress(addressText: string): { street: string; city: string; state: string; zipCode: string } | null {
  // Common address pattern: Street, City, ST ZIP
  const match = addressText.match(/(.+?),\s*(.+?),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/i);
  if (match) {
    return {
      street: match[1].trim(),
      city: match[2].trim(),
      state: match[3].toUpperCase(),
      zipCode: match[4],
    };
  }
  return null;
}

function detectBureauFromContext($: cheerio.CheerioAPI, el: AnyNode): 'transunion' | 'experian' | 'equifax' {
  const parentText = $(el).parents().slice(0, 3).text().toLowerCase();
  if (parentText.includes('transunion')) return 'transunion';
  if (parentText.includes('experian')) return 'experian';
  if (parentText.includes('equifax')) return 'equifax';
  return 'transunion'; // Default
}

function determineAccountStatus(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('closed')) return 'closed';
  if (lower.includes('collection')) return 'collection';
  if (lower.includes('charge') && lower.includes('off')) return 'charge_off';
  if (lower.includes('paid')) return 'paid';
  if (lower.includes('transferred')) return 'transferred';
  return 'open';
}

function determinePaymentStatus(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('180') && lower.includes('late')) return '180_days_late';
  if (lower.includes('150') && lower.includes('late')) return '150_days_late';
  if (lower.includes('120') && lower.includes('late')) return '120_days_late';
  if (lower.includes('90') && lower.includes('late')) return '90_days_late';
  if (lower.includes('60') && lower.includes('late')) return '60_days_late';
  if (lower.includes('30') && lower.includes('late')) return '30_days_late';
  if (lower.includes('collection')) return 'collection';
  if (lower.includes('charge') && lower.includes('off')) return 'charge_off';
  return 'current';
}

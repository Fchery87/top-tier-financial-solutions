// Equifax Direct Parser
// Handles HTML/PDF reports directly from myEquifax.com

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { ParsedCreditData, ParsedAccount, ParsedNegativeItem, ParsedInquiry, ParsedConsumerProfile } from './pdf-parser';
import {
  isAccountNegative,
  calculateRiskLevel,
} from './metro2-mapping';

// Equifax-specific CSS selectors
const EQ_SELECTORS = {
  // Score section - Equifax uses both FICO and VantageScore
  scoreSection: '.eq-score, .equifax-score, .credit-score, [class*="score-box"]',
  scoreValue: '.score-value, .eq-score-value, [class*="scoreValue"]',
  
  // Consumer info - Equifax specific layout
  consumerSection: '.consumer-info, .eq-personal, .personal-info, [class*="consumer"]',
  nameField: '.consumer-name, .eq-name, [class*="name"]',
  addressField: '.eq-address, .address, [class*="address"]',
  
  // Account sections - Equifax uses "Accounts" or "Credit Accounts"
  accountSection: '.account, .eq-account, .credit-account, [class*="account-detail"]',
  accountTable: 'table.eq-accounts, table[class*="account"]',
  accountRow: 'tr.eq-account, tr[class*="account-row"]',
  
  // Account fields
  creditorName: '.creditor-name, .eq-creditor, [class*="creditor"]',
  accountNumber: '.account-number, .eq-account-num, [class*="accountNumber"]',
  accountType: '.account-type, .eq-type, [class*="accountType"]',
  accountStatus: '.account-status, .eq-status, [class*="status"]',
  balance: '.balance, .eq-balance, [class*="balance"]',
  creditLimit: '.credit-limit, .eq-limit, [class*="limit"]',
  highCredit: '.high-credit, .eq-high-credit, [class*="highCredit"]',
  dateOpened: '.date-opened, .eq-opened, [class*="dateOpened"]',
  dateReported: '.date-reported, .eq-reported, [class*="dateReported"]',
  paymentStatus: '.payment-status, .eq-payment, [class*="paymentStatus"]',
  
  // Negative items
  negativeSection: '.negative-info, .eq-negative, .adverse-accounts, [class*="negative"]',
  collectionSection: '.collections, .eq-collections, [class*="collection"]',
  publicRecords: '.public-records, .eq-public, [class*="publicRecord"]',
  
  // Inquiries
  inquirySection: '.inquiries, .eq-inquiries, [class*="inquiry"]',
  inquiryItem: '.inquiry-item, .eq-inquiry, [class*="inquiryRow"]',
  
  // Equifax-specific
  alertSection: '.eq-alerts, .credit-alerts, [class*="alert"]',
  fraudSection: '.eq-fraud, .fraud-alerts, [class*="fraud"]',
};

// Equifax text patterns
const EQ_PATTERNS = {
  ficoScore: /(?:Equifax\s*)?FICO[®]?\s*(?:Score)?[:\s]*(\d{3})/i,
  vantageScore: /VantageScore[®]?\s*(?:3\.0)?[:\s]*(\d{3})/i,
  equifaxScore: /Equifax[:\s]*(?:Score)?[:\s]*(\d{3})/i,
  accountNumber: /(?:Account|Acct)\s*(?:#|Number|No\.?)[:\s]*([X\d*#-]+)/i,
  balance: /(?:Balance|Current\s*Balance|Amount\s*Owed)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  creditLimit: /(?:Credit\s*Limit|Limit|High\s*Credit)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  dateOpened: /(?:Date\s*Opened|Opened|Open\s*Date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
  dateReported: /(?:Date\s*(?:Last\s*)?Reported|Last\s*Updated)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
  paymentPattern: /(?:Payment\s*Status|Pay\s*Status)[:\s]*([A-Za-z0-9\s]+)/i,
  accountOwner: /(?:Responsibility|Account\s*Owner)[:\s]*([A-Za-z\s]+)/i,
  termsMonths: /(?:Terms|Months\s*Reviewed)[:\s]*(\d+)/i,
};

export function parseEquifaxReport(html: string): ParsedCreditData {
  const $ = cheerio.load(html);
  const text = $.text();

  const scores = extractEQScores($, text);
  const consumerProfile = extractEQConsumerProfile($, text);
  const accounts = extractEQAccounts($, text);
  const negativeItems = extractEQNegativeItems(accounts, $, text);
  const inquiries = extractEQInquiries($, text);
  const summary = calculateEQSummary(accounts);

  return {
    scores,
    accounts,
    negativeItems,
    inquiries,
    summary,
    rawText: text,
    consumerProfile,
  } as ParsedCreditData & { consumerProfile: ParsedConsumerProfile };
}

function extractEQScores($: cheerio.CheerioAPI, text: string): ParsedCreditData['scores'] {
  const scores: ParsedCreditData['scores'] = {};

  // Try FICO Score first (common for Equifax)
  let ficoMatch = text.match(EQ_PATTERNS.ficoScore);
  if (ficoMatch) {
    const score = parseInt(ficoMatch[1]);
    if (score >= 300 && score <= 850) {
      scores.equifax = score;
    }
  }

  // Try VantageScore
  if (!scores.equifax) {
    const vantageMatch = text.match(EQ_PATTERNS.vantageScore);
    if (vantageMatch) {
      const score = parseInt(vantageMatch[1]);
      if (score >= 300 && score <= 850) {
        scores.equifax = score;
      }
    }
  }

  // Try structured elements
  $(EQ_SELECTORS.scoreSection).each((_, section) => {
    const sectionEl = $(section);
    const scoreText = sectionEl.find(EQ_SELECTORS.scoreValue).text() || sectionEl.text();

    const match = scoreText.match(/(\d{3})/);
    if (match && !scores.equifax) {
      const score = parseInt(match[1]);
      if (score >= 300 && score <= 850) {
        scores.equifax = score;
      }
    }
  });

  // Text pattern fallback
  if (!scores.equifax) {
    const eqMatch = text.match(EQ_PATTERNS.equifaxScore);
    if (eqMatch) {
      const score = parseInt(eqMatch[1]);
      if (score >= 300 && score <= 850) {
        scores.equifax = score;
      }
    }
  }

  return scores;
}

function extractEQConsumerProfile($: cheerio.CheerioAPI, text: string): ParsedConsumerProfile {
  const profile: ParsedConsumerProfile = {
    names: [],
    addresses: [],
    employers: [],
  };

  $(EQ_SELECTORS.consumerSection).each((_, section) => {
    const sectionEl = $(section);
    
    // Names
    sectionEl.find(EQ_SELECTORS.nameField).each((_, el) => {
      const nameText = $(el).text().trim();
      if (nameText.length > 2 && nameText.length < 80) {
        const parts = nameText.split(/\s+/);
        if (parts.length >= 2) {
          profile.names.push({
            firstName: parts[0],
            middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined,
            lastName: parts[parts.length - 1],
            bureau: 'equifax',
          });
        }
      }
    });

    // Addresses
    sectionEl.find(EQ_SELECTORS.addressField).each((_, el) => {
      const addrText = $(el).text().trim();
      const parsed = parseAddress(addrText);
      if (parsed) {
        profile.addresses.push({ ...parsed, bureau: 'equifax' });
      }
    });
  });

  // SSN
  const ssnMatch = text.match(/(?:SSN|Social\s*Security)[:\s]*(?:XXX-XX-)?(\d{4})/i);
  if (ssnMatch) profile.ssnLast4 = ssnMatch[1];

  // DOB
  const dobMatch = text.match(/(?:DOB|Date\s*of\s*Birth|Birth\s*Date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
  if (dobMatch) profile.dateOfBirth = parseDate(dobMatch[1]);

  // Employers (Equifax includes employment section)
  const employerSection = text.match(/(?:Employment|Employer\s*Information)[\s\S]*?(?=Address|Account|$)/i);
  if (employerSection) {
    const employers = employerSection[0].matchAll(/(?:Employer|Company)[:\s]*([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s+(?:since|from|Position)|\n|$)/gi);
    for (const match of employers) {
      const name = match[1].trim();
      if (name.length > 2 && name.length < 80) {
        profile.employers.push({ name, bureau: 'equifax' });
      }
    }
  }

  return profile;
}

function extractEQAccounts($: cheerio.CheerioAPI, text: string): ParsedAccount[] {
  const accounts: ParsedAccount[] = [];
  const seen = new Set<string>();

  // Section-based extraction
  $(EQ_SELECTORS.accountSection).each((_, section) => {
    const account = parseAccountSection($, section as Element);
    if (account && account.creditorName) {
      const key = `${account.creditorName.toLowerCase()}-${account.accountNumber || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        accounts.push(account);
      }
    }
  });

  // Table-based extraction
  $(EQ_SELECTORS.accountTable + ', table').each((_, table) => {
    const tableText = $(table).text().toLowerCase();
    if (tableText.includes('creditor') || tableText.includes('account') || tableText.includes('balance')) {
      const headers = extractTableHeaders($, table as Element);
      
      $(table).find('tbody tr, tr').each((_, row) => {
        if ($(row).find('th').length > 0) return;
        
        const account = parseTableRow($, row as Element, headers);
        if (account && account.creditorName) {
          const key = `${account.creditorName.toLowerCase()}-${account.accountNumber || ''}`;
          if (!seen.has(key)) {
            seen.add(key);
            accounts.push(account);
          }
        }
      });
    }
  });

  // Text fallback
  if (accounts.length === 0) {
    accounts.push(...parseTextAccounts(text));
  }

  return accounts;
}

function extractTableHeaders($: cheerio.CheerioAPI, table: Element): Map<string, number> {
  const headers = new Map<string, number>();
  $(table).find('thead th, tr:first-child th, tr:first-child td').each((i, cell) => {
    const text = $(cell).text().toLowerCase().trim();
    if (text.includes('creditor') || text.includes('company') || text.includes('name')) headers.set('creditor', i);
    else if (text.includes('account') && (text.includes('number') || text.includes('#'))) headers.set('accountNum', i);
    else if (text.includes('type')) headers.set('type', i);
    else if (text.includes('status')) headers.set('status', i);
    else if (text.includes('balance')) headers.set('balance', i);
    else if (text.includes('limit') || text.includes('high credit')) headers.set('limit', i);
    else if (text.includes('opened')) headers.set('opened', i);
    else if (text.includes('reported') || text.includes('updated')) headers.set('reported', i);
    else if (text.includes('payment')) headers.set('payment', i);
  });
  return headers;
}

function parseTableRow($: cheerio.CheerioAPI, row: Element, headers: Map<string, number>): ParsedAccount | null {
  const cells = $(row).find('td');
  if (cells.length < 2) return null;

  const getCell = (key: string): string => {
    const idx = headers.get(key);
    return idx !== undefined ? $(cells[idx]).text().trim() : '';
  };

  const creditorName = getCell('creditor') || $(cells[0]).text().trim();
  if (!creditorName || creditorName.length < 2) return null;

  const rowText = $(row).text();
  const account: ParsedAccount = {
    creditorName: creditorName.substring(0, 100),
    accountNumber: getCell('accountNum') || undefined,
    accountType: getCell('type') || inferAccountType(rowText),
    accountStatus: parseStatus(getCell('status') || rowText),
    balance: parseMoney(getCell('balance')),
    creditLimit: parseMoney(getCell('limit')),
    paymentStatus: parsePaymentStatus(getCell('payment') || getCell('status') || rowText),
    dateOpened: parseDate(getCell('opened')),
    dateReported: parseDate(getCell('reported')),
    bureau: 'equifax',
    isNegative: false,
    riskLevel: 'low',
  };

  account.isNegative = isAccountNegative(account as any);
  account.riskLevel = calculateRiskLevel(account as any);

  return account;
}

function parseAccountSection($: cheerio.CheerioAPI, section: Element): ParsedAccount | null {
  const sectionEl = $(section);
  const sectionText = sectionEl.text();

  let creditorName = sectionEl.find(EQ_SELECTORS.creditorName).first().text().trim();
  if (!creditorName) {
    creditorName = sectionEl.find('strong, b, h4, h3, .title, .name').first().text().trim();
  }
  if (!creditorName || creditorName.length < 2) return null;

  const account: ParsedAccount = {
    creditorName: creditorName.substring(0, 100),
    accountNumber: sectionEl.find(EQ_SELECTORS.accountNumber).text().trim() || 
      sectionText.match(EQ_PATTERNS.accountNumber)?.[1] || undefined,
    accountType: sectionEl.find(EQ_SELECTORS.accountType).text().trim() || inferAccountType(sectionText),
    accountStatus: parseStatus(sectionEl.find(EQ_SELECTORS.accountStatus).text() || sectionText),
    balance: parseMoney(sectionEl.find(EQ_SELECTORS.balance).text() || sectionText.match(EQ_PATTERNS.balance)?.[1]),
    creditLimit: parseMoney(sectionEl.find(EQ_SELECTORS.creditLimit).text() || 
      sectionEl.find(EQ_SELECTORS.highCredit).text() ||
      sectionText.match(EQ_PATTERNS.creditLimit)?.[1]),
    paymentStatus: parsePaymentStatus(sectionEl.find(EQ_SELECTORS.paymentStatus).text() || sectionText),
    dateOpened: parseDate(sectionEl.find(EQ_SELECTORS.dateOpened).text() || 
      sectionText.match(EQ_PATTERNS.dateOpened)?.[1]),
    dateReported: parseDate(sectionEl.find(EQ_SELECTORS.dateReported).text() ||
      sectionText.match(EQ_PATTERNS.dateReported)?.[1]),
    bureau: 'equifax',
    isNegative: false,
    riskLevel: 'low',
  };

  account.isNegative = isAccountNegative(account as any);
  account.riskLevel = calculateRiskLevel(account as any);

  return account;
}

function parseTextAccounts(text: string): ParsedAccount[] {
  const accounts: ParsedAccount[] = [];
  const sections = text.split(/(?=(?:Account|Creditor|Company\s*Name)[:\s])/i);

  for (const section of sections) {
    if (section.length < 40) continue;

    const nameMatch = section.match(/(?:Account|Creditor|Company\s*Name)[:\s]*([A-Z][A-Za-z0-9\s&.,'-]+)/i);
    if (!nameMatch) continue;

    const creditorName = nameMatch[1].trim().substring(0, 100);
    if (creditorName.length < 2) continue;

    const account: ParsedAccount = {
      creditorName,
      accountNumber: section.match(EQ_PATTERNS.accountNumber)?.[1],
      balance: parseMoney(section.match(EQ_PATTERNS.balance)?.[1]),
      creditLimit: parseMoney(section.match(EQ_PATTERNS.creditLimit)?.[1]),
      dateOpened: parseDate(section.match(EQ_PATTERNS.dateOpened)?.[1]),
      dateReported: parseDate(section.match(EQ_PATTERNS.dateReported)?.[1]),
      accountStatus: parseStatus(section),
      paymentStatus: parsePaymentStatus(section),
      bureau: 'equifax',
      isNegative: false,
      riskLevel: 'low',
    };

    account.isNegative = isAccountNegative(account as any);
    account.riskLevel = calculateRiskLevel(account as any);
    accounts.push(account);
  }

  return accounts;
}

function extractEQNegativeItems(accounts: ParsedAccount[], $: cheerio.CheerioAPI, text: string): ParsedNegativeItem[] {
  const items: ParsedNegativeItem[] = [];

  for (const account of accounts) {
    if (account.isNegative) {
      items.push({
        itemType: getItemType(account),
        creditorName: account.creditorName,
        amount: account.balance,
        dateReported: account.dateReported,
        bureau: 'equifax',
        riskSeverity: account.riskLevel || 'medium',
      });
    }
  }

  // From negative sections
  $(`${EQ_SELECTORS.negativeSection}, ${EQ_SELECTORS.collectionSection}`).find('tr, .item, li, .account').each((_, el) => {
    const elText = $(el).text();
    const nameMatch = elText.match(/([A-Z][A-Za-z0-9\s&.,'-]{2,50})/);
    const amountMatch = elText.match(/\$?([\d,]+(?:\.\d{2})?)/);

    if (nameMatch) {
      const name = nameMatch[1].trim();
      if (!items.some(i => i.creditorName.toLowerCase() === name.toLowerCase())) {
        items.push({
          itemType: 'collection',
          creditorName: name,
          amount: parseMoney(amountMatch?.[1]),
          bureau: 'equifax',
          riskSeverity: 'high',
        });
      }
    }
  });

  return items;
}

function extractEQInquiries($: cheerio.CheerioAPI, text: string): ParsedInquiry[] {
  const inquiries: ParsedInquiry[] = [];

  $(EQ_SELECTORS.inquirySection).find(EQ_SELECTORS.inquiryItem + ', tr, .item').each((_, el) => {
    const elText = $(el).text();
    const nameMatch = elText.match(/([A-Z][A-Za-z0-9\s&.,'-]+)/);
    const dateMatch = elText.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);

    if (nameMatch) {
      inquiries.push({
        creditorName: nameMatch[1].trim(),
        inquiryDate: dateMatch ? parseDate(dateMatch[1]) : undefined,
        bureau: 'equifax',
      });
    }
  });

  if (inquiries.length === 0) {
    const section = text.match(/(?:Inquiries|Credit\s*Inquiries)[\s\S]*?(?=Account|Public|Employment|$)/i);
    if (section) {
      const matches = section[0].matchAll(/([A-Z][A-Za-z0-9\s&.,'-]+)\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g);
      for (const m of matches) {
        inquiries.push({ creditorName: m[1].trim(), inquiryDate: parseDate(m[2]), bureau: 'equifax' });
      }
    }
  }

  return inquiries;
}

function calculateEQSummary(accounts: ParsedAccount[]): ParsedCreditData['summary'] {
  const open = accounts.filter(a => a.accountStatus === 'open');
  const closed = accounts.filter(a => a.accountStatus === 'closed');

  let debt = 0, limit = 0;
  for (const a of accounts) {
    if (a.balance) debt += a.balance;
    if (a.creditLimit) limit += a.creditLimit;
  }

  return {
    totalAccounts: accounts.length,
    openAccounts: open.length,
    closedAccounts: closed.length,
    totalDebt: debt,
    totalCreditLimit: limit,
    utilizationPercent: limit > 0 ? Math.round((debt / limit) * 100) : 0,
  };
}

// Helper functions
function parseAddress(text: string): { street: string; city: string; state: string; zipCode: string } | null {
  const m = text.match(/(.+?),\s*(.+?),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/i);
  return m ? { street: m[1].trim(), city: m[2].trim(), state: m[3].toUpperCase(), zipCode: m[4] } : null;
}

function parseMoney(val: string | undefined | null): number | undefined {
  if (!val) return undefined;
  const n = parseFloat(val.replace(/[$,]/g, ''));
  return isNaN(n) ? undefined : Math.round(n * 100);
}

function parseDate(str: string | undefined | null): Date | undefined {
  if (!str) return undefined;
  const d = new Date(str.replace(/-/g, '/'));
  return isNaN(d.getTime()) ? undefined : d;
}

function parseStatus(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('closed')) return 'closed';
  if (t.includes('collection')) return 'collection';
  if (t.includes('charge') && t.includes('off')) return 'charge_off';
  if (t.includes('paid')) return 'paid';
  if (t.includes('transferred')) return 'transferred';
  return 'open';
}

function parsePaymentStatus(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('180')) return '180_days_late';
  if (t.includes('150')) return '150_days_late';
  if (t.includes('120')) return '120_days_late';
  if (t.includes('90')) return '90_days_late';
  if (t.includes('60')) return '60_days_late';
  if (t.includes('30')) return '30_days_late';
  if (t.includes('collection')) return 'collection';
  if (t.includes('charge')) return 'charge_off';
  if (t.includes('current') || t.includes('ok') || t.includes('as agreed')) return 'current';
  return 'current';
}

function inferAccountType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('credit card') || t.includes('revolving') || t.includes('visa') || t.includes('mastercard')) return 'credit_card';
  if (t.includes('auto') || t.includes('vehicle') || t.includes('car')) return 'auto_loan';
  if (t.includes('mortgage') || t.includes('home loan') || t.includes('real estate')) return 'mortgage';
  if (t.includes('student')) return 'student_loan';
  if (t.includes('collection')) return 'collection';
  if (t.includes('installment')) return 'installment';
  if (t.includes('medical')) return 'medical';
  return 'other';
}

function getItemType(account: ParsedAccount): string {
  if (account.accountStatus === 'collection') return 'collection';
  if (account.accountStatus === 'charge_off') return 'charge_off';
  if (account.paymentStatus?.includes('late')) return 'late_payment';
  return 'derogatory';
}

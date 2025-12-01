// TransUnion Direct Parser
// Handles HTML/PDF reports directly from TransUnion.com

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { ParsedCreditData, ParsedAccount, ParsedNegativeItem, ParsedInquiry, ParsedConsumerProfile } from './pdf-parser';
import {
  isAccountNegative,
  calculateRiskLevel,
} from './metro2-mapping';

// TransUnion-specific CSS selectors
const TU_SELECTORS = {
  // Score section - TransUnion often shows VantageScore
  scoreSection: '.tu-score, .vantage-score, .credit-score, [class*="score-container"]',
  scoreValue: '.score-value, .score-number, [class*="scoreValue"]',
  
  // Consumer info - TransUnion specific layout
  consumerSection: '.consumer-info, .personal-information, .tu-personal, [class*="consumer"]',
  nameField: '.consumer-name, .tu-name, [class*="fullName"]',
  addressField: '.tu-address, .address-block, [class*="address"]',
  
  // Account sections - TransUnion uses "Trade Lines" terminology
  tradelineSection: '.tradeline, .tu-tradeline, .account-section, [class*="tradeline"]',
  accountTable: 'table.tu-accounts, table[class*="tradeline"]',
  accountRow: 'tr.tu-account, tr[class*="tradeline-row"]',
  
  // Account fields
  creditorName: '.creditor-name, .tu-creditor, [class*="creditor"]',
  accountNumber: '.account-number, .tu-account-num, [class*="accountNumber"]',
  accountType: '.account-type, .tu-type, [class*="accountType"]',
  accountStatus: '.account-status, .tu-status, [class*="status"]',
  balance: '.balance, .tu-balance, [class*="balance"]',
  creditLimit: '.credit-limit, .tu-limit, [class*="creditLimit"]',
  highCredit: '.high-credit, .tu-high-credit, [class*="highCredit"]',
  dateOpened: '.date-opened, .tu-opened, [class*="dateOpened"]',
  dateReported: '.date-reported, .tu-reported, [class*="dateReported"]',
  paymentStatus: '.payment-status, .tu-payment, [class*="paymentStatus"]',
  paymentHistory: '.payment-history, .tu-history, [class*="paymentHistory"]',
  
  // Negative items
  negativeSection: '.negative-info, .tu-negative, .adverse, [class*="negative"]',
  collectionSection: '.collections, .tu-collections, [class*="collection"]',
  publicRecords: '.public-records, .tu-public, [class*="publicRecord"]',
  
  // Inquiries
  inquirySection: '.inquiries, .tu-inquiries, [class*="inquiry"]',
  inquiryItem: '.inquiry-item, .tu-inquiry, [class*="inquiryRow"]',
  
  // TransUnion specific sections
  summarySection: '.tu-summary, .credit-summary, [class*="summary"]',
  disputeSection: '.tu-dispute, [class*="dispute"]',
};

// TransUnion text patterns
const TU_PATTERNS = {
  vantageScore: /VantageScore[®]?\s*3\.0[:\s]*(\d{3})/i,
  tuScore: /TransUnion[:\s]*(?:Score)?[:\s]*(\d{3})/i,
  accountNumber: /(?:Account|Acct)\s*(?:#|Number|No\.?)[:\s]*([X\d*#-]+)/i,
  balance: /(?:Balance|Current\s*Balance|Amount\s*Owed)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  creditLimit: /(?:Credit\s*Limit|High\s*Credit|Limit)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  dateOpened: /(?:Date\s*Opened|Opened|Open\s*Date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
  dateReported: /(?:Date\s*Reported|Last\s*Reported|Updated)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
  paymentPattern: /(?:Pay\s*Status|Payment\s*Status)[:\s]*([A-Za-z0-9\s]+)/i,
  ecoa: /ECOA[:\s]*([A-Za-z]+)/i,
  responsibility: /(?:Responsibility|Account\s*Type)[:\s]*([A-Za-z\s]+)/i,
};

export function parseTransUnionReport(html: string): ParsedCreditData {
  const $ = cheerio.load(html);
  const text = $.text();

  const scores = extractTUScores($, text);
  const consumerProfile = extractTUConsumerProfile($, text);
  const accounts = extractTUAccounts($, text);
  const negativeItems = extractTUNegativeItems(accounts, $, text);
  const inquiries = extractTUInquiries($, text);
  const summary = calculateTUSummary(accounts);

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

function extractTUScores($: cheerio.CheerioAPI, text: string): ParsedCreditData['scores'] {
  const scores: ParsedCreditData['scores'] = {};

  // Try VantageScore first (TransUnion's preferred score)
  const vantageMatch = text.match(TU_PATTERNS.vantageScore);
  if (vantageMatch) {
    const score = parseInt(vantageMatch[1]);
    if (score >= 300 && score <= 850) {
      scores.transunion = score;
    }
  }

  // Try structured elements
  $(TU_SELECTORS.scoreSection).each((_, section) => {
    const sectionEl = $(section);
    const scoreText = sectionEl.find(TU_SELECTORS.scoreValue).text() || sectionEl.text();

    const match = scoreText.match(/(\d{3})/);
    if (match && !scores.transunion) {
      const score = parseInt(match[1]);
      if (score >= 300 && score <= 850) {
        scores.transunion = score;
      }
    }
  });

  // Text pattern fallback
  if (!scores.transunion) {
    const tuMatch = text.match(TU_PATTERNS.tuScore);
    if (tuMatch) {
      const score = parseInt(tuMatch[1]);
      if (score >= 300 && score <= 850) {
        scores.transunion = score;
      }
    }
  }

  return scores;
}

function extractTUConsumerProfile($: cheerio.CheerioAPI, text: string): ParsedConsumerProfile {
  const profile: ParsedConsumerProfile = {
    names: [],
    addresses: [],
    employers: [],
  };

  $(TU_SELECTORS.consumerSection).each((_, section) => {
    const sectionEl = $(section);
    
    // Names
    sectionEl.find(TU_SELECTORS.nameField).each((_, el) => {
      const nameText = $(el).text().trim();
      if (nameText.length > 2 && nameText.length < 80) {
        const parts = nameText.split(/\s+/);
        if (parts.length >= 2) {
          profile.names.push({
            firstName: parts[0],
            middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined,
            lastName: parts[parts.length - 1],
            bureau: 'transunion',
          });
        }
      }
    });

    // Addresses
    sectionEl.find(TU_SELECTORS.addressField).each((_, el) => {
      const addrText = $(el).text().trim();
      const parsed = parseAddress(addrText);
      if (parsed) {
        profile.addresses.push({ ...parsed, bureau: 'transunion' });
      }
    });
  });

  // SSN
  const ssnMatch = text.match(/(?:SSN|Social\s*Security)[:\s]*(?:XXX-XX-)?(\d{4})/i);
  if (ssnMatch) profile.ssnLast4 = ssnMatch[1];

  // DOB
  const dobMatch = text.match(/(?:DOB|Date\s*of\s*Birth|Birth\s*Date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
  if (dobMatch) profile.dateOfBirth = parseDate(dobMatch[1]);

  // Employers (TransUnion often includes this)
  const employerMatch = text.match(/(?:Employer|Employment)[:\s]*([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s+since|\n|$)/gi);
  if (employerMatch) {
    for (const match of employerMatch) {
      const name = match.replace(/(?:Employer|Employment)[:\s]*/i, '').trim();
      if (name.length > 2 && name.length < 80) {
        profile.employers.push({ name, bureau: 'transunion' });
      }
    }
  }

  return profile;
}

function extractTUAccounts($: cheerio.CheerioAPI, text: string): ParsedAccount[] {
  const accounts: ParsedAccount[] = [];
  const seen = new Set<string>();

  // Tradeline section extraction (TransUnion's term)
  $(TU_SELECTORS.tradelineSection).each((_, section) => {
    const account = parseTradelineSection($, section as Element);
    if (account && account.creditorName) {
      const key = `${account.creditorName.toLowerCase()}-${account.accountNumber || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        accounts.push(account);
      }
    }
  });

  // Table-based extraction
  $(TU_SELECTORS.accountTable + ', table').each((_, table) => {
    const tableText = $(table).text().toLowerCase();
    if (tableText.includes('creditor') || tableText.includes('account') || tableText.includes('tradeline')) {
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
    else if (text.includes('ecoa')) headers.set('ecoa', i);
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
    bureau: 'transunion',
    isNegative: false,
    riskLevel: 'low',
  };

  account.isNegative = isAccountNegative(account as any);
  account.riskLevel = calculateRiskLevel(account as any);

  return account;
}

function parseTradelineSection($: cheerio.CheerioAPI, section: Element): ParsedAccount | null {
  const sectionEl = $(section);
  const sectionText = sectionEl.text();

  let creditorName = sectionEl.find(TU_SELECTORS.creditorName).first().text().trim();
  if (!creditorName) {
    creditorName = sectionEl.find('strong, b, h4, h3, .title').first().text().trim();
  }
  if (!creditorName || creditorName.length < 2) return null;

  const account: ParsedAccount = {
    creditorName: creditorName.substring(0, 100),
    accountNumber: sectionEl.find(TU_SELECTORS.accountNumber).text().trim() || 
      sectionText.match(TU_PATTERNS.accountNumber)?.[1] || undefined,
    accountType: sectionEl.find(TU_SELECTORS.accountType).text().trim() || inferAccountType(sectionText),
    accountStatus: parseStatus(sectionEl.find(TU_SELECTORS.accountStatus).text() || sectionText),
    balance: parseMoney(sectionEl.find(TU_SELECTORS.balance).text() || sectionText.match(TU_PATTERNS.balance)?.[1]),
    creditLimit: parseMoney(sectionEl.find(TU_SELECTORS.creditLimit).text() || 
      sectionEl.find(TU_SELECTORS.highCredit).text() ||
      sectionText.match(TU_PATTERNS.creditLimit)?.[1]),
    paymentStatus: parsePaymentStatus(sectionEl.find(TU_SELECTORS.paymentStatus).text() || sectionText),
    dateOpened: parseDate(sectionEl.find(TU_SELECTORS.dateOpened).text() || 
      sectionText.match(TU_PATTERNS.dateOpened)?.[1]),
    dateReported: parseDate(sectionEl.find(TU_SELECTORS.dateReported).text() ||
      sectionText.match(TU_PATTERNS.dateReported)?.[1]),
    bureau: 'transunion',
    isNegative: false,
    riskLevel: 'low',
  };

  account.isNegative = isAccountNegative(account as any);
  account.riskLevel = calculateRiskLevel(account as any);

  return account;
}

function parseTextAccounts(text: string): ParsedAccount[] {
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
      accountNumber: section.match(TU_PATTERNS.accountNumber)?.[1],
      balance: parseMoney(section.match(TU_PATTERNS.balance)?.[1]),
      creditLimit: parseMoney(section.match(TU_PATTERNS.creditLimit)?.[1]),
      dateOpened: parseDate(section.match(TU_PATTERNS.dateOpened)?.[1]),
      dateReported: parseDate(section.match(TU_PATTERNS.dateReported)?.[1]),
      accountStatus: parseStatus(section),
      paymentStatus: parsePaymentStatus(section),
      bureau: 'transunion',
      isNegative: false,
      riskLevel: 'low',
    };

    account.isNegative = isAccountNegative(account as any);
    account.riskLevel = calculateRiskLevel(account as any);
    accounts.push(account);
  }

  return accounts;
}

function extractTUNegativeItems(accounts: ParsedAccount[], $: cheerio.CheerioAPI, text: string): ParsedNegativeItem[] {
  const items: ParsedNegativeItem[] = [];

  for (const account of accounts) {
    if (account.isNegative) {
      items.push({
        itemType: getItemType(account),
        creditorName: account.creditorName,
        amount: account.balance,
        dateReported: account.dateReported,
        bureau: 'transunion',
        riskSeverity: account.riskLevel || 'medium',
      });
    }
  }

  // From negative sections
  $(`${TU_SELECTORS.negativeSection}, ${TU_SELECTORS.collectionSection}`).find('tr, .item, li').each((_, el) => {
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
          bureau: 'transunion',
          riskSeverity: 'high',
        });
      }
    }
  });

  return items;
}

function extractTUInquiries($: cheerio.CheerioAPI, text: string): ParsedInquiry[] {
  const inquiries: ParsedInquiry[] = [];

  $(TU_SELECTORS.inquirySection).find(TU_SELECTORS.inquiryItem + ', tr, .item').each((_, el) => {
    const elText = $(el).text();
    const nameMatch = elText.match(/([A-Z][A-Za-z0-9\s&.,'-]+)/);
    const dateMatch = elText.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);

    if (nameMatch) {
      inquiries.push({
        creditorName: nameMatch[1].trim(),
        inquiryDate: dateMatch ? parseDate(dateMatch[1]) : undefined,
        bureau: 'transunion',
      });
    }
  });

  if (inquiries.length === 0) {
    const section = text.match(/(?:Inquiries|Regular\s*Inquiries)[\s\S]*?(?=Account|Public|$)/i);
    if (section) {
      const matches = section[0].matchAll(/([A-Z][A-Za-z0-9\s&.,'-]+)\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g);
      for (const m of matches) {
        inquiries.push({ creditorName: m[1].trim(), inquiryDate: parseDate(m[2]), bureau: 'transunion' });
      }
    }
  }

  return inquiries;
}

function calculateTUSummary(accounts: ParsedAccount[]): ParsedCreditData['summary'] {
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
  if (t.includes('current') || t.includes('pays as agreed') || t.includes('ok')) return 'current';
  return 'current';
}

function inferAccountType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('credit card') || t.includes('revolving') || t.includes('visa') || t.includes('mastercard')) return 'credit_card';
  if (t.includes('auto') || t.includes('vehicle') || t.includes('car')) return 'auto_loan';
  if (t.includes('mortgage') || t.includes('home loan')) return 'mortgage';
  if (t.includes('student')) return 'student_loan';
  if (t.includes('collection')) return 'collection';
  if (t.includes('installment')) return 'installment';
  return 'other';
}

function getItemType(account: ParsedAccount): string {
  if (account.accountStatus === 'collection') return 'collection';
  if (account.accountStatus === 'charge_off') return 'charge_off';
  if (account.paymentStatus?.includes('late')) return 'late_payment';
  return 'derogatory';
}

// Experian Direct Parser
// Handles HTML/PDF reports directly from Experian.com

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { ParsedCreditData, ParsedAccount, ParsedNegativeItem, ParsedInquiry, ParsedConsumerProfile } from './pdf-parser';
import {
  isAccountNegative,
  calculateRiskLevel,
  type StandardizedAccount,
} from './metro2-mapping';

// Experian-specific CSS selectors
const EX_SELECTORS = {
  // Score section - Experian uses FICO Score 8
  scoreSection: '.ex-score, .fico-score, .experian-score, [class*="score-display"]',
  scoreValue: '.score-value, .fico-value, [class*="scoreNum"]',
  
  // Consumer info - Experian specific layout
  consumerSection: '.consumer-info, .ex-personal, .personal-information, [class*="consumer"]',
  nameField: '.consumer-name, .ex-name, [class*="name"]',
  addressField: '.ex-address, .address, [class*="address"]',
  
  // Account sections - Experian uses "Accounts" or "Credit Accounts"
  accountSection: '.account, .ex-account, .credit-account, [class*="account-item"]',
  accountTable: 'table.ex-accounts, table[class*="account"]',
  accountRow: 'tr.ex-account, tr[class*="account-row"]',
  accountCard: '.account-card, .ex-card, [class*="accountCard"]',
  
  // Account fields
  creditorName: '.creditor-name, .ex-creditor, [class*="creditor"]',
  accountNumber: '.account-number, .ex-account-num, [class*="accountNumber"]',
  accountType: '.account-type, .ex-type, [class*="accountType"]',
  accountStatus: '.account-status, .ex-status, [class*="status"]',
  balance: '.balance, .ex-balance, [class*="balance"]',
  creditLimit: '.credit-limit, .ex-limit, [class*="limit"]',
  originalAmount: '.original-amount, .ex-original, [class*="original"]',
  dateOpened: '.date-opened, .ex-opened, [class*="dateOpened"]',
  dateReported: '.date-reported, .ex-reported, [class*="dateReported"]',
  paymentStatus: '.payment-status, .ex-payment, [class*="paymentStatus"]',
  monthlyPayment: '.monthly-payment, .ex-monthly, [class*="monthlyPayment"]',
  
  // Negative items
  negativeSection: '.negative-info, .ex-negative, .potentially-negative, [class*="negative"]',
  collectionSection: '.collections, .ex-collections, [class*="collection"]',
  publicRecords: '.public-records, .ex-public, [class*="publicRecord"]',
  
  // Inquiries - Experian separates hard and soft
  inquirySection: '.inquiries, .ex-inquiries, [class*="inquiry"]',
  hardInquiries: '.hard-inquiries, .ex-hard, [class*="hardInquiry"]',
  softInquiries: '.soft-inquiries, .ex-soft, [class*="softInquiry"]',
  inquiryItem: '.inquiry-item, .ex-inquiry, [class*="inquiryRow"]',
};

// Experian text patterns
const EX_PATTERNS = {
  ficoScore: /FICO[®]?\s*(?:Score\s*)?8?[:\s]*(\d{3})/i,
  experianScore: /Experian[:\s]*(?:Score)?[:\s]*(\d{3})/i,
  accountNumber: /(?:Account|Acct)\s*(?:#|Number|No\.?)[:\s]*([X\d*#-]+)/i,
  balance: /(?:Balance|Current\s*Balance|Amount)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  creditLimit: /(?:Credit\s*Limit|Limit)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  originalAmount: /(?:Original\s*Amount|Original\s*Balance)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  dateOpened: /(?:Date\s*Opened|Opened)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
  dateReported: /(?:Date\s*(?:of\s*)?(?:Last\s*)?Report(?:ed)?|Updated)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
  paymentPattern: /(?:Status|Payment\s*Status)[:\s]*([A-Za-z0-9\s,]+)/i,
  accountOwner: /(?:Responsibility|Owner)[:\s]*([A-Za-z\s]+)/i,
};

export function parseExperianReport(html: string): ParsedCreditData {
  const $ = cheerio.load(html);
  const text = $.text();

  const scores = extractEXScores($, text);
  const consumerProfile = extractEXConsumerProfile($, text);
  const accounts = extractEXAccounts($, text);
  const negativeItems = extractEXNegativeItems(accounts, $, text);
  const inquiries = extractEXInquiries($, text);
  const summary = calculateEXSummary(accounts);

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

function extractEXScores($: cheerio.CheerioAPI, text: string): ParsedCreditData['scores'] {
  const scores: ParsedCreditData['scores'] = {};

  // Try FICO Score first (Experian's preferred)
  const ficoMatch = text.match(EX_PATTERNS.ficoScore);
  if (ficoMatch) {
    const score = parseInt(ficoMatch[1]);
    if (score >= 300 && score <= 850) {
      scores.experian = score;
    }
  }

  // Try structured elements
  $(EX_SELECTORS.scoreSection).each((_, section) => {
    const sectionEl = $(section);
    const scoreText = sectionEl.find(EX_SELECTORS.scoreValue).text() || sectionEl.text();

    const match = scoreText.match(/(\d{3})/);
    if (match && !scores.experian) {
      const score = parseInt(match[1]);
      if (score >= 300 && score <= 850) {
        scores.experian = score;
      }
    }
  });

  // Text pattern fallback
  if (!scores.experian) {
    const exMatch = text.match(EX_PATTERNS.experianScore);
    if (exMatch) {
      const score = parseInt(exMatch[1]);
      if (score >= 300 && score <= 850) {
        scores.experian = score;
      }
    }
  }

  return scores;
}

function extractEXConsumerProfile($: cheerio.CheerioAPI, text: string): ParsedConsumerProfile {
  const profile: ParsedConsumerProfile = {
    names: [],
    addresses: [],
    employers: [],
  };

  $(EX_SELECTORS.consumerSection).each((_, section) => {
    const sectionEl = $(section);
    
    // Names
    sectionEl.find(EX_SELECTORS.nameField).each((_, el) => {
      const nameText = $(el).text().trim();
      if (nameText.length > 2 && nameText.length < 80) {
        const parts = nameText.split(/\s+/);
        if (parts.length >= 2) {
          profile.names.push({
            firstName: parts[0],
            middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined,
            lastName: parts[parts.length - 1],
            bureau: 'experian',
          });
        }
      }
    });

    // Addresses
    sectionEl.find(EX_SELECTORS.addressField).each((_, el) => {
      const addrText = $(el).text().trim();
      const parsed = parseAddress(addrText);
      if (parsed) {
        profile.addresses.push({ ...parsed, bureau: 'experian' });
      }
    });
  });

  // SSN
  const ssnMatch = text.match(/(?:SSN|Social\s*Security)[:\s]*(?:XXX-XX-)?(\d{4})/i);
  if (ssnMatch) profile.ssnLast4 = ssnMatch[1];

  // DOB
  const dobMatch = text.match(/(?:DOB|Date\s*of\s*Birth|Year\s*of\s*Birth)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4})/i);
  if (dobMatch) {
    if (dobMatch[1].length === 4) {
      // Year only
      profile.dateOfBirth = new Date(parseInt(dobMatch[1]), 0, 1);
    } else {
      profile.dateOfBirth = parseDate(dobMatch[1]);
    }
  }

  // Employers
  const employerMatch = text.match(/(?:Employer|Employment)[:\s]*([A-Z][A-Za-z0-9\s&.,'-]+?)(?:\s+(?:since|from)|\n|$)/gi);
  if (employerMatch) {
    for (const match of employerMatch) {
      const name = match.replace(/(?:Employer|Employment)[:\s]*/i, '').trim();
      if (name.length > 2 && name.length < 80) {
        profile.employers.push({ name, bureau: 'experian' });
      }
    }
  }

  return profile;
}

function extractEXAccounts($: cheerio.CheerioAPI, text: string): ParsedAccount[] {
  const accounts: ParsedAccount[] = [];
  const seen = new Set<string>();

  // Card-based extraction (Experian often uses cards)
  $(`${EX_SELECTORS.accountCard}, ${EX_SELECTORS.accountSection}`).each((_, section) => {
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
  $(EX_SELECTORS.accountTable + ', table').each((_, table) => {
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
    else if (text.includes('limit')) headers.set('limit', i);
    else if (text.includes('opened')) headers.set('opened', i);
    else if (text.includes('reported') || text.includes('updated')) headers.set('reported', i);
    else if (text.includes('payment')) headers.set('payment', i);
    else if (text.includes('original')) headers.set('original', i);
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
    bureau: 'experian',
    isNegative: false,
    riskLevel: 'low',
  };

  account.isNegative = isAccountNegative(account as Partial<StandardizedAccount>);
  account.riskLevel = calculateRiskLevel(account as Partial<StandardizedAccount>);

  return account;
}

function parseAccountSection($: cheerio.CheerioAPI, section: Element): ParsedAccount | null {
  const sectionEl = $(section);
  const sectionText = sectionEl.text();

  let creditorName = sectionEl.find(EX_SELECTORS.creditorName).first().text().trim();
  if (!creditorName) {
    creditorName = sectionEl.find('strong, b, h4, h3, .title, .name').first().text().trim();
  }
  if (!creditorName || creditorName.length < 2) return null;

  const account: ParsedAccount = {
    creditorName: creditorName.substring(0, 100),
    accountNumber: sectionEl.find(EX_SELECTORS.accountNumber).text().trim() || 
      sectionText.match(EX_PATTERNS.accountNumber)?.[1] || undefined,
    accountType: sectionEl.find(EX_SELECTORS.accountType).text().trim() || inferAccountType(sectionText),
    accountStatus: parseStatus(sectionEl.find(EX_SELECTORS.accountStatus).text() || sectionText),
    balance: parseMoney(sectionEl.find(EX_SELECTORS.balance).text() || sectionText.match(EX_PATTERNS.balance)?.[1]),
    creditLimit: parseMoney(sectionEl.find(EX_SELECTORS.creditLimit).text() || 
      sectionText.match(EX_PATTERNS.creditLimit)?.[1]),
    paymentStatus: parsePaymentStatus(sectionEl.find(EX_SELECTORS.paymentStatus).text() || sectionText),
    dateOpened: parseDate(sectionEl.find(EX_SELECTORS.dateOpened).text() || 
      sectionText.match(EX_PATTERNS.dateOpened)?.[1]),
    dateReported: parseDate(sectionEl.find(EX_SELECTORS.dateReported).text() ||
      sectionText.match(EX_PATTERNS.dateReported)?.[1]),
    bureau: 'experian',
    isNegative: false,
    riskLevel: 'low',
  };

  account.isNegative = isAccountNegative(account as Partial<StandardizedAccount>);
  account.riskLevel = calculateRiskLevel(account as Partial<StandardizedAccount>);

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
      accountNumber: section.match(EX_PATTERNS.accountNumber)?.[1],
      balance: parseMoney(section.match(EX_PATTERNS.balance)?.[1]),
      creditLimit: parseMoney(section.match(EX_PATTERNS.creditLimit)?.[1]),
      dateOpened: parseDate(section.match(EX_PATTERNS.dateOpened)?.[1]),
      dateReported: parseDate(section.match(EX_PATTERNS.dateReported)?.[1]),
      accountStatus: parseStatus(section),
      paymentStatus: parsePaymentStatus(section),
      bureau: 'experian',
      isNegative: false,
      riskLevel: 'low',
    };

    account.isNegative = isAccountNegative(account as Partial<StandardizedAccount>);
    account.riskLevel = calculateRiskLevel(account as Partial<StandardizedAccount>);
    accounts.push(account);
  }

  return accounts;
}

function extractEXNegativeItems(accounts: ParsedAccount[], $: cheerio.CheerioAPI, _text: string): ParsedNegativeItem[] {
  const items: ParsedNegativeItem[] = [];

  for (const account of accounts) {
    if (account.isNegative) {
      items.push({
        itemType: getItemType(account),
        creditorName: account.creditorName,
        amount: account.balance,
        dateReported: account.dateReported,
        bureau: 'experian',
        riskSeverity: account.riskLevel || 'medium',
      });
    }
  }

  // From negative sections (Experian calls this "Potentially Negative")
  $(`${EX_SELECTORS.negativeSection}, ${EX_SELECTORS.collectionSection}`).find('tr, .item, li, .account').each((_, el) => {
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
          bureau: 'experian',
          riskSeverity: 'high',
        });
      }
    }
  });

  return items;
}

function extractEXInquiries($: cheerio.CheerioAPI, text: string): ParsedInquiry[] {
  const inquiries: ParsedInquiry[] = [];

  // Hard inquiries first
  $(`${EX_SELECTORS.hardInquiries}, ${EX_SELECTORS.inquirySection}`).find(EX_SELECTORS.inquiryItem + ', tr, .item').each((_, el) => {
    const elText = $(el).text();
    const nameMatch = elText.match(/([A-Z][A-Za-z0-9\s&.,'-]+)/);
    const dateMatch = elText.match(/(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);

    if (nameMatch) {
      inquiries.push({
        creditorName: nameMatch[1].trim(),
        inquiryDate: dateMatch ? parseDate(dateMatch[1]) : undefined,
        bureau: 'experian',
      });
    }
  });

  if (inquiries.length === 0) {
    const section = text.match(/(?:Hard\s*Inquiries|Inquiries\s*that\s*may\s*impact)[\s\S]*?(?=Soft|Account|Public|$)/i);
    if (section) {
      const matches = section[0].matchAll(/([A-Z][A-Za-z0-9\s&.,'-]+)\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g);
      for (const m of matches) {
        inquiries.push({ creditorName: m[1].trim(), inquiryDate: parseDate(m[2]), bureau: 'experian' });
      }
    }
  }

  return inquiries;
}

function calculateEXSummary(accounts: ParsedAccount[]): ParsedCreditData['summary'] {
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
  if (t.includes('current') || t.includes('ok') || t.includes('paid as agreed')) return 'current';
  return 'current';
}

function inferAccountType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('credit card') || t.includes('revolving') || t.includes('visa') || t.includes('mastercard') || t.includes('amex')) return 'credit_card';
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

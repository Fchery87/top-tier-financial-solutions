// AnnualCreditReport.com Parser
// Handles HTML/PDF reports from the official free annual credit report site

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { ParsedCreditData, ParsedAccount, ParsedNegativeItem, ParsedInquiry, ParsedConsumerProfile } from './pdf-parser';
import {
  isAccountNegative,
  calculateRiskLevel,
} from './metro2-mapping';

// AnnualCreditReport.com specific selectors
const ACR_SELECTORS = {
  // Score sections - ACR shows scores from each bureau
  scoreSection: '.credit-score, .score-section, [class*="score"]',
  scoreValue: '.score-value, .credit-score-value, [class*="score-num"]',
  bureauName: '.bureau-name, .score-bureau, [class*="bureau"]',
  
  // Consumer info section
  consumerSection: '.consumer-information, .personal-info, #consumer-info, [class*="personal"]',
  nameField: '.consumer-name, .name, [class*="name"]',
  addressField: '.address, [class*="address"]',
  ssnField: '.ssn, [class*="ssn"]',
  dobField: '.dob, .birth-date, [class*="birth"]',
  
  // Account sections - ACR uses detailed tables
  accountSection: '.tradeline, .account, .credit-account, [class*="tradeline"]',
  accountTable: 'table[class*="account"], table[class*="tradeline"]',
  accountRow: 'tr[class*="account"], tr[class*="tradeline"]',
  
  // Account fields
  creditorName: '.creditor, .account-name, .company-name, [class*="creditor"]',
  accountNumber: '.account-number, [class*="account-num"]',
  accountType: '.account-type, [class*="type"]',
  accountStatus: '.account-status, [class*="status"]',
  balance: '.balance, .current-balance, [class*="balance"]',
  creditLimit: '.credit-limit, .high-credit, [class*="limit"]',
  paymentStatus: '.payment-status, [class*="payment"]',
  dateOpened: '.date-opened, [class*="opened"]',
  dateReported: '.date-reported, [class*="reported"]',
  
  // Negative/Derogatory sections
  negativeSection: '.negative-information, .derogatory, [class*="negative"]',
  collectionSection: '.collections, [class*="collection"]',
  publicRecords: '.public-records, [class*="public-record"]',
  
  // Inquiries
  inquirySection: '.inquiries, .credit-inquiries, [class*="inquiry"]',
  inquiryItem: '.inquiry-item, [class*="inquiry-row"]',
};

// ACR text patterns
const ACR_PATTERNS = {
  bureauScore: /(?:TransUnion|Experian|Equifax)[:\s]*(?:Score)?[:\s]*(\d{3})/gi,
  accountNumber: /(?:Account\s*(?:#|Number|No\.?))[:\s]*([X\d*#-]+)/i,
  balance: /(?:Balance|Current\s*Balance|Amount)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  creditLimit: /(?:Credit\s*Limit|High\s*Credit|Limit)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  dateOpened: /(?:Date\s*Opened|Opened)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
  dateReported: /(?:Date\s*Reported|Last\s*Reported|Reported)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
  paymentHistory: /(?:Payment\s*History)[:\s]*([\dOKXCL\s-]+)/i,
};

export function parseAnnualCreditReport(html: string): ParsedCreditData {
  const $ = cheerio.load(html);
  const text = $.text();

  const scores = extractACRScores($, text);
  const consumerProfile = extractACRConsumerProfile($, text);
  const accounts = extractACRAccounts($, text);
  const negativeItems = extractACRNegativeItems(accounts, $, text);
  const inquiries = extractACRInquiries($, text);
  const summary = calculateACRSummary(accounts);

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

function extractACRScores($: cheerio.CheerioAPI, text: string): ParsedCreditData['scores'] {
  const scores: ParsedCreditData['scores'] = {};

  // Try structured elements
  $(ACR_SELECTORS.scoreSection).each((_, section) => {
    const sectionEl = $(section);
    const scoreText = sectionEl.find(ACR_SELECTORS.scoreValue).text() || sectionEl.text();
    const bureauText = sectionEl.find(ACR_SELECTORS.bureauName).text() || sectionEl.attr('data-bureau') || '';

    const match = scoreText.match(/(\d{3})/);
    if (match) {
      const score = parseInt(match[1]);
      if (score >= 300 && score <= 850) {
        assignScore(scores, bureauText || sectionEl.text(), score);
      }
    }
  });

  // Text pattern fallback
  const bureauMatches = text.matchAll(ACR_PATTERNS.bureauScore);
  for (const match of bureauMatches) {
    const score = parseInt(match[1]);
    if (score >= 300 && score <= 850) {
      const bureau = match[0].toLowerCase();
      if (bureau.includes('transunion') && !scores.transunion) scores.transunion = score;
      else if (bureau.includes('experian') && !scores.experian) scores.experian = score;
      else if (bureau.includes('equifax') && !scores.equifax) scores.equifax = score;
    }
  }

  return scores;
}

function extractACRConsumerProfile($: cheerio.CheerioAPI, text: string): ParsedConsumerProfile {
  const profile: ParsedConsumerProfile = {
    names: [],
    addresses: [],
    employers: [],
  };

  // Extract from consumer section
  $(ACR_SELECTORS.consumerSection).each((_, section) => {
    const sectionEl = $(section);
    
    // Names
    sectionEl.find(ACR_SELECTORS.nameField).each((_, el) => {
      const nameText = $(el).text().trim();
      if (nameText.length > 2 && nameText.length < 80) {
        const parts = nameText.split(/\s+/);
        if (parts.length >= 2) {
          profile.names.push({
            firstName: parts[0],
            middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined,
            lastName: parts[parts.length - 1],
          });
        }
      }
    });

    // Addresses
    sectionEl.find(ACR_SELECTORS.addressField).each((_, el) => {
      const addrText = $(el).text().trim();
      const parsed = parseAddress(addrText);
      if (parsed) {
        profile.addresses.push(parsed);
      }
    });
  });

  // SSN
  const ssnMatch = text.match(/(?:SSN|Social\s*Security)[:\s]*(?:XXX-XX-)?(\d{4})/i);
  if (ssnMatch) profile.ssnLast4 = ssnMatch[1];

  // DOB
  const dobMatch = text.match(/(?:DOB|Date\s*of\s*Birth|Birth\s*Date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
  if (dobMatch) profile.dateOfBirth = parseDate(dobMatch[1]);

  return profile;
}

function extractACRAccounts($: cheerio.CheerioAPI, text: string): ParsedAccount[] {
  const accounts: ParsedAccount[] = [];
  const seen = new Set<string>();

  // Table-based extraction (common for ACR)
  $('table').each((_, table) => {
    const tableText = $(table).text().toLowerCase();
    if (tableText.includes('account') || tableText.includes('creditor') || tableText.includes('tradeline')) {
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

  // Section-based extraction
  $(ACR_SELECTORS.accountSection).each((_, section) => {
    const account = parseAccountSection($, section as Element);
    if (account && account.creditorName) {
      const key = `${account.creditorName.toLowerCase()}-${account.accountNumber || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        accounts.push(account);
      }
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
    else if (text.includes('reported')) headers.set('reported', i);
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
    accountType: getCell('type') || undefined,
    accountStatus: parseStatus(getCell('status') || rowText),
    balance: parseMoney(getCell('balance')),
    creditLimit: parseMoney(getCell('limit')),
    paymentStatus: parsePaymentStatus(getCell('payment') || getCell('status') || rowText),
    dateOpened: parseDate(getCell('opened')),
    dateReported: parseDate(getCell('reported')),
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

  let creditorName = sectionEl.find(ACR_SELECTORS.creditorName).first().text().trim();
  if (!creditorName) {
    creditorName = sectionEl.find('strong, b, h4, .title').first().text().trim();
  }
  if (!creditorName || creditorName.length < 2) return null;

  const account: ParsedAccount = {
    creditorName: creditorName.substring(0, 100),
    accountNumber: sectionEl.find(ACR_SELECTORS.accountNumber).text().trim() || 
      sectionText.match(ACR_PATTERNS.accountNumber)?.[1] || undefined,
    accountType: sectionEl.find(ACR_SELECTORS.accountType).text().trim() || undefined,
    accountStatus: parseStatus(sectionEl.find(ACR_SELECTORS.accountStatus).text() || sectionText),
    balance: parseMoney(sectionEl.find(ACR_SELECTORS.balance).text() || sectionText.match(ACR_PATTERNS.balance)?.[1]),
    creditLimit: parseMoney(sectionEl.find(ACR_SELECTORS.creditLimit).text() || sectionText.match(ACR_PATTERNS.creditLimit)?.[1]),
    paymentStatus: parsePaymentStatus(sectionEl.find(ACR_SELECTORS.paymentStatus).text() || sectionText),
    dateOpened: parseDate(sectionEl.find(ACR_SELECTORS.dateOpened).text()),
    dateReported: parseDate(sectionEl.find(ACR_SELECTORS.dateReported).text()),
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
      accountNumber: section.match(ACR_PATTERNS.accountNumber)?.[1],
      balance: parseMoney(section.match(ACR_PATTERNS.balance)?.[1]),
      creditLimit: parseMoney(section.match(ACR_PATTERNS.creditLimit)?.[1]),
      dateOpened: parseDate(section.match(ACR_PATTERNS.dateOpened)?.[1]),
      dateReported: parseDate(section.match(ACR_PATTERNS.dateReported)?.[1]),
      accountStatus: parseStatus(section),
      paymentStatus: parsePaymentStatus(section),
      isNegative: false,
      riskLevel: 'low',
    };

    account.isNegative = isAccountNegative(account as any);
    account.riskLevel = calculateRiskLevel(account as any);
    accounts.push(account);
  }

  return accounts;
}

function extractACRNegativeItems(accounts: ParsedAccount[], $: cheerio.CheerioAPI, text: string): ParsedNegativeItem[] {
  const items: ParsedNegativeItem[] = [];

  // From accounts
  for (const account of accounts) {
    if (account.isNegative) {
      items.push({
        itemType: getItemType(account),
        creditorName: account.creditorName,
        amount: account.balance,
        dateReported: account.dateReported,
        riskSeverity: account.riskLevel || 'medium',
      });
    }
  }

  // From negative sections
  $(`${ACR_SELECTORS.negativeSection}, ${ACR_SELECTORS.collectionSection}`).find('tr, .item, li').each((_, el) => {
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
          riskSeverity: 'high',
        });
      }
    }
  });

  return items;
}

function extractACRInquiries($: cheerio.CheerioAPI, text: string): ParsedInquiry[] {
  const inquiries: ParsedInquiry[] = [];

  $(ACR_SELECTORS.inquirySection).find(ACR_SELECTORS.inquiryItem + ', tr, .item').each((_, el) => {
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
    const section = text.match(/(?:Inquiries|Hard\s*Inquiries)[\s\S]*?(?=Account|Public|$)/i);
    if (section) {
      const matches = section[0].matchAll(/([A-Z][A-Za-z0-9\s&.,'-]+)\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g);
      for (const m of matches) {
        inquiries.push({ creditorName: m[1].trim(), inquiryDate: parseDate(m[2]) });
      }
    }
  }

  return inquiries;
}

function calculateACRSummary(accounts: ParsedAccount[]): ParsedCreditData['summary'] {
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
function assignScore(scores: ParsedCreditData['scores'], text: string, score: number) {
  const t = text.toLowerCase();
  if (t.includes('transunion') || t.includes(' tu')) scores.transunion = score;
  else if (t.includes('experian') || t.includes(' ex')) scores.experian = score;
  else if (t.includes('equifax') || t.includes(' eq')) scores.equifax = score;
}

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
  return 'current';
}

function getItemType(account: ParsedAccount): string {
  if (account.accountStatus === 'collection') return 'collection';
  if (account.accountStatus === 'charge_off') return 'charge_off';
  if (account.paymentStatus?.includes('late')) return 'late_payment';
  return 'derogatory';
}

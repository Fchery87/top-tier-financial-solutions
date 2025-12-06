// PrivacyGuard Credit Report Parser
// Handles HTML reports exported from PrivacyGuard monitoring service

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { ParsedCreditData, ParsedAccount, ParsedNegativeItem, ParsedInquiry } from './pdf-parser';
import {
  StandardizedConsumerProfile,
  isAccountNegative,
  type StandardizedAccount,
  calculateRiskLevel,
} from './metro2-mapping';

// PrivacyGuard-specific CSS selectors
const PG_SELECTORS = {
  // Scores - PrivacyGuard often uses gauge/meter displays
  scoreSection: '.score-section, .credit-scores, [class*="score-container"]',
  scoreGauge: '.score-gauge, .score-meter, [class*="gauge"]',
  scoreValue: '.score-number, .score-value, [class*="scoreNum"]',
  bureauLabel: '.bureau-name, .score-label, [class*="bureau"]',
  
  // Accounts - PrivacyGuard uses detailed tables
  accountsSection: '.accounts-section, .tradelines, [class*="accounts"]',
  accountTable: 'table.account-table, table[class*="tradeline"]',
  accountRow: 'tr[class*="account"], tr[class*="tradeline"], tbody tr',
  accountDetail: '.account-detail, .tradeline-detail, [class*="detail"]',
  
  // Fields
  creditor: '.creditor-name, .company, [class*="creditor"]',
  acctNum: '.account-num, [class*="accountNum"]',
  acctType: '.account-type, [class*="type"]',
  status: '.status, [class*="status"]',
  balance: '.balance, [class*="balance"]',
  limit: '.credit-limit, [class*="limit"]',
  opened: '.date-opened, [class*="opened"]',
  reported: '.date-reported, [class*="reported"]',
  payStatus: '.payment-status, [class*="payment"]',
  
  // Consumer info
  consumerInfo: '.consumer-info, .personal-information, [class*="consumer"]',
  nameEl: '.name, [class*="name"]',
  addressEl: '.address, [class*="address"]',
  
  // Inquiries
  inquiriesSection: '.inquiries, [class*="inquiry"]',
  inquiryRow: '.inquiry-row, tr[class*="inquiry"]',
  
  // Negative/Derogatory
  negativeSection: '.negative-items, .derogatory-marks, [class*="negative"]',
  collectionSection: '.collections, [class*="collection"]',
  publicRecords: '.public-records, [class*="public"]',
};

// PrivacyGuard text patterns
const PG_PATTERNS = {
  score: /(?:TransUnion|Experian|Equifax)\s*(?:Score)?[:\s]*(\d{3})/gi,
  accountNum: /(?:Account|Acct)\s*(?:#|Number|No\.?)[:\s]*([X\d*#-]+)/i,
  balance: /(?:Balance|Amount\s*Owed|Current)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  limit: /(?:Credit\s*Limit|Limit|High\s*Credit)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  datePattern: /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
};

export function parsePrivacyGuardReport(html: string): ParsedCreditData {
  const $ = cheerio.load(html);
  const text = $.text();

  const scores = extractPGScores($, text);
  const consumerProfile = extractPGConsumerProfile($, text);
  const accounts = extractPGAccounts($, text);
  const negativeItems = extractPGNegativeItems(accounts, $, text);
  const inquiries = extractPGInquiries($, text);
  const summary = calculatePGSummary(accounts);

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

function extractPGScores($: cheerio.CheerioAPI, text: string): ParsedCreditData['scores'] {
  const scores: ParsedCreditData['scores'] = {};

  // Try gauge/meter elements first
  $(PG_SELECTORS.scoreGauge + ', ' + PG_SELECTORS.scoreSection).each((_, el) => {
    const elQuery = $(el);
    const scoreText = elQuery.find(PG_SELECTORS.scoreValue).text() || elQuery.text();
    const bureauText = elQuery.find(PG_SELECTORS.bureauLabel).text() || 
      elQuery.attr('data-bureau') || elQuery.closest('[data-bureau]').attr('data-bureau') || '';

    const scoreMatch = scoreText.match(/(\d{3})/);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]);
      if (score >= 300 && score <= 850) {
        setBureauScore(scores, bureauText || elQuery.text(), score);
      }
    }
  });

  // Text fallback
  const textMatches = text.matchAll(PG_PATTERNS.score);
  for (const match of textMatches) {
    const score = parseInt(match[1]);
    if (score >= 300 && score <= 850) {
      const bureauText = match[0].toLowerCase();
      if (bureauText.includes('transunion') && !scores.transunion) scores.transunion = score;
      else if (bureauText.includes('experian') && !scores.experian) scores.experian = score;
      else if (bureauText.includes('equifax') && !scores.equifax) scores.equifax = score;
    }
  }

  return scores;
}

function extractPGConsumerProfile($: cheerio.CheerioAPI, text: string): StandardizedConsumerProfile {
  const profile: StandardizedConsumerProfile = {
    names: [],
    addresses: [],
    employers: [],
  };

  $(PG_SELECTORS.consumerInfo).each((_, section) => {
    const sectionEl = $(section);
    
    // Names
    sectionEl.find(PG_SELECTORS.nameEl).each((_, el) => {
      const nameText = $(el).text().trim();
      if (nameText.length > 2 && nameText.length < 100) {
        const parts = nameText.split(/\s+/);
        if (parts.length >= 2) {
          profile.names.push({
            firstName: parts[0],
            middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined,
            lastName: parts[parts.length - 1],
            bureau: detectBureau($, el),
          });
        }
      }
    });

    // Addresses
    sectionEl.find(PG_SELECTORS.addressEl).each((_, el) => {
      const addrText = $(el).text().trim();
      const parsed = parseAddress(addrText);
      if (parsed) {
        profile.addresses.push({ ...parsed, bureau: detectBureau($, el) });
      }
    });
  });

  // SSN
  const ssnMatch = text.match(/SSN[:\s]*(?:XXX-XX-)?(\d{4})/i);
  if (ssnMatch) profile.ssnLast4 = ssnMatch[1];

  // DOB
  const dobMatch = text.match(/(?:DOB|Date\s*of\s*Birth)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
  if (dobMatch) profile.dateOfBirth = parseDate(dobMatch[1]);

  return profile;
}

function extractPGAccounts($: cheerio.CheerioAPI, text: string): ParsedAccount[] {
  const accounts: ParsedAccount[] = [];
  const seen = new Set<string>();

  // Table-based extraction
  $(PG_SELECTORS.accountTable).each((_, table) => {
    const headers = getTableHeaders($, table as Element);
    
    $(table).find('tbody tr, ' + PG_SELECTORS.accountRow).each((_, row) => {
      if ($(row).find('th').length > 0) return;
      
      const account = parseTableRowAccount($, row as Element, headers);
      if (account && account.creditorName) {
        const key = `${account.creditorName.toLowerCase()}-${account.accountNumber || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          accounts.push(account);
        }
      }
    });
  });

  // Detail-section extraction
  $(PG_SELECTORS.accountDetail).each((_, el) => {
    const account = parseDetailSection($, el as Element);
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
    accounts.push(...extractTextAccounts(text));
  }

  return accounts;
}

function getTableHeaders($: cheerio.CheerioAPI, table: Element): Map<string, number> {
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
    else if (text.includes('reported')) headers.set('reported', i);
    else if (text.includes('payment')) headers.set('payment', i);
  });
  return headers;
}

function parseTableRowAccount($: cheerio.CheerioAPI, row: Element, headers: Map<string, number>): ParsedAccount | null {
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

  account.isNegative = isAccountNegative(account as Partial<StandardizedAccount>);
  account.riskLevel = calculateRiskLevel(account as Partial<StandardizedAccount>);

  return account;
}

function parseDetailSection($: cheerio.CheerioAPI, el: Element): ParsedAccount | null {
  const elQuery = $(el);
  const elText = elQuery.text();

  const creditorName = elQuery.find(PG_SELECTORS.creditor).first().text().trim() ||
    elQuery.find('strong, b, h4, .title').first().text().trim();
  
  if (!creditorName || creditorName.length < 2) return null;

  const account: ParsedAccount = {
    creditorName: creditorName.substring(0, 100),
    accountNumber: elQuery.find(PG_SELECTORS.acctNum).text().trim() || 
      elText.match(PG_PATTERNS.accountNum)?.[1] || undefined,
    accountType: elQuery.find(PG_SELECTORS.acctType).text().trim() || undefined,
    accountStatus: parseStatus(elQuery.find(PG_SELECTORS.status).text() || elText),
    balance: parseMoney(elQuery.find(PG_SELECTORS.balance).text() || elText.match(PG_PATTERNS.balance)?.[1]),
    creditLimit: parseMoney(elQuery.find(PG_SELECTORS.limit).text() || elText.match(PG_PATTERNS.limit)?.[1]),
    paymentStatus: parsePaymentStatus(elQuery.find(PG_SELECTORS.payStatus).text() || elText),
    dateOpened: parseDate(elQuery.find(PG_SELECTORS.opened).text()),
    dateReported: parseDate(elQuery.find(PG_SELECTORS.reported).text()),
    isNegative: false,
    riskLevel: 'low',
  };

  account.isNegative = isAccountNegative(account as Partial<StandardizedAccount>);
  account.riskLevel = calculateRiskLevel(account as Partial<StandardizedAccount>);

  return account;
}

function extractTextAccounts(text: string): ParsedAccount[] {
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
      accountNumber: section.match(PG_PATTERNS.accountNum)?.[1],
      balance: parseMoney(section.match(PG_PATTERNS.balance)?.[1]),
      creditLimit: parseMoney(section.match(PG_PATTERNS.limit)?.[1]),
      accountStatus: parseStatus(section),
      paymentStatus: parsePaymentStatus(section),
      isNegative: false,
      riskLevel: 'low',
    };

    account.isNegative = isAccountNegative(account as Partial<StandardizedAccount>);
    account.riskLevel = calculateRiskLevel(account as Partial<StandardizedAccount>);
    accounts.push(account);
  }

  return accounts;
}

function extractPGNegativeItems(accounts: ParsedAccount[], $: cheerio.CheerioAPI, _text: string): ParsedNegativeItem[] {
  const items: ParsedNegativeItem[] = [];

  // From accounts
  for (const account of accounts) {
    if (account.isNegative) {
      items.push({
        itemType: getNegativeType(account),
        creditorName: account.creditorName,
        amount: account.balance,
        dateReported: account.dateReported,
        riskSeverity: account.riskLevel || 'medium',
      });
    }
  }

  // From dedicated sections
  $(`${PG_SELECTORS.negativeSection}, ${PG_SELECTORS.collectionSection}`).find('tr, .item, li').each((_, el) => {
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

function extractPGInquiries($: cheerio.CheerioAPI, text: string): ParsedInquiry[] {
  const inquiries: ParsedInquiry[] = [];

  $(PG_SELECTORS.inquiriesSection).find(PG_SELECTORS.inquiryRow + ', tr, .item').each((_, el) => {
    const elText = $(el).text();
    const nameMatch = elText.match(/([A-Z][A-Za-z0-9\s&.,'-]+)/);
    const dateMatch = elText.match(PG_PATTERNS.datePattern);

    if (nameMatch) {
      inquiries.push({
        creditorName: nameMatch[1].trim(),
        inquiryDate: dateMatch ? parseDate(dateMatch[1]) : undefined,
      });
    }
  });

  // Fallback
  if (inquiries.length === 0) {
    const section = text.match(/(?:Inquiries)[\s\S]*?(?=Account|Public|$)/i);
    if (section) {
      const matches = section[0].matchAll(/([A-Z][A-Za-z0-9\s&.,'-]+)\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g);
      for (const m of matches) {
        inquiries.push({ creditorName: m[1].trim(), inquiryDate: parseDate(m[2]) });
      }
    }
  }

  return inquiries;
}

function calculatePGSummary(accounts: ParsedAccount[]): ParsedCreditData['summary'] {
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

// Helpers
function setBureauScore(scores: ParsedCreditData['scores'], text: string, score: number) {
  const t = text.toLowerCase();
  if (t.includes('transunion') || t.includes(' tu')) scores.transunion = score;
  else if (t.includes('experian') || t.includes(' ex')) scores.experian = score;
  else if (t.includes('equifax') || t.includes(' eq')) scores.equifax = score;
}

function detectBureau($: cheerio.CheerioAPI, el: Element): 'transunion' | 'experian' | 'equifax' {
  const ctx = $(el).parents('[data-bureau]').attr('data-bureau') || $(el).closest('.bureau').text().toLowerCase();
  if (ctx.includes('transunion')) return 'transunion';
  if (ctx.includes('experian')) return 'experian';
  if (ctx.includes('equifax')) return 'equifax';
  return 'transunion';
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

function getNegativeType(account: ParsedAccount): string {
  if (account.accountStatus === 'collection') return 'collection';
  if (account.accountStatus === 'charge_off') return 'charge_off';
  if (account.paymentStatus?.includes('late')) return 'late_payment';
  return 'derogatory';
}

// MyScoreIQ Credit Report Parser
// Handles HTML reports exported from MyScoreIQ monitoring service

import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';
import type { ParsedCreditData, ParsedAccount, ParsedNegativeItem, ParsedInquiry } from './pdf-parser';
import {
  StandardizedConsumerProfile,
  isAccountNegative,
  calculateRiskLevel,
  type StandardizedAccount,
} from './metro2-mapping';

// MyScoreIQ-specific CSS selectors
const MSIQ_SELECTORS = {
  // Score displays - MyScoreIQ often uses prominent score displays
  scoreWrapper: '.score-wrapper, .credit-score-display, [class*="scoreDisplay"]',
  scoreNumber: '.score-number, .big-score, [class*="scoreNum"]',
  bureauName: '.bureau-name, .score-bureau, [class*="bureau"]',
  scoreChange: '.score-change, [class*="change"]',
  
  // Account listings
  accountList: '.account-list, .tradeline-list, [class*="accountList"]',
  accountEntry: '.account-entry, .tradeline-entry, [class*="accountEntry"]',
  accountBlock: '.account-block, [class*="accountBlock"]',
  
  // Account fields
  creditorField: '.creditor, .account-name, [class*="creditor"]',
  accountNumField: '.account-number, [class*="accountNumber"]',
  typeField: '.account-type, [class*="type"]',
  statusField: '.status, [class*="status"]',
  balanceField: '.balance, [class*="balance"]',
  limitField: '.limit, [class*="limit"]',
  openedField: '.opened, [class*="opened"]',
  reportedField: '.reported, [class*="reported"]',
  paymentField: '.payment-status, [class*="payment"]',
  historyField: '.payment-history, [class*="history"]',
  
  // Personal info
  personalSection: '.personal-info, .consumer-data, [class*="personal"]',
  fullName: '.full-name, [class*="fullName"]',
  addressInfo: '.address-info, [class*="address"]',
  
  // Inquiries
  inquirySection: '.inquiry-section, [class*="inquiries"]',
  inquiryEntry: '.inquiry-entry, [class*="inquiry"]',
  
  // Negative items
  alertSection: '.alert-section, .negative-alerts, [class*="alert"]',
  collectionAlert: '.collection-alert, [class*="collection"]',
  derogatorySection: '.derogatory, [class*="derogatory"]',
  
  // Bureau tabs/sections
  bureauTab: '[data-bureau], .bureau-tab, [class*="bureauTab"]',
  bureauContent: '.bureau-content, [class*="bureauContent"]',
};

// MyScoreIQ patterns
const MSIQ_PATTERNS = {
  score: /(?:TransUnion|Experian|Equifax)[:\s]*(\d{3})/gi,
  ficoScore: /FICO[®]?\s*Score[:\s]*(\d{3})/gi,
  accountNum: /(?:Account|Acct)\s*(?:#|Number)[:\s]*([X\d*#-]+)/i,
  balance: /(?:Balance|Current|Owed)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  limit: /(?:Limit|Credit\s*Line|High\s*Credit)[:\s]*\$?([\d,]+(?:\.\d{2})?)/i,
  date: /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/,
};

export function parseMyScoreIQReport(html: string): ParsedCreditData {
  const $ = cheerio.load(html);
  const text = $.text();

  const scores = extractMSIQScores($, text);
  const consumerProfile = extractMSIQConsumerProfile($, text);
  const accounts = extractMSIQAccounts($, text);
  const negativeItems = extractMSIQNegativeItems(accounts, $, text);
  const inquiries = extractMSIQInquiries($, text);
  const summary = calculateMSIQSummary(accounts);

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

function extractMSIQScores($: cheerio.CheerioAPI, text: string): ParsedCreditData['scores'] {
  const scores: ParsedCreditData['scores'] = {};

  // Try structured score elements
  $(MSIQ_SELECTORS.scoreWrapper).each((_, wrapper) => {
    const wrapperEl = $(wrapper);
    const scoreText = wrapperEl.find(MSIQ_SELECTORS.scoreNumber).text() || wrapperEl.text();
    const bureauText = wrapperEl.find(MSIQ_SELECTORS.bureauName).text() || 
      wrapperEl.attr('data-bureau') || wrapperEl.closest('[data-bureau]').attr('data-bureau') || '';

    const match = scoreText.match(/(\d{3})/);
    if (match) {
      const score = parseInt(match[1]);
      if (score >= 300 && score <= 850) {
        assignScore(scores, bureauText || wrapperEl.text(), score);
      }
    }
  });

  // Bureau tab sections
  $(MSIQ_SELECTORS.bureauTab).each((_, tab) => {
    const bureau = $(tab).attr('data-bureau') || $(tab).text();
    const content = $(tab).closest(MSIQ_SELECTORS.bureauContent).text() || $(tab).next().text();
    const match = content.match(/(\d{3})/);
    if (match) {
      const score = parseInt(match[1]);
      if (score >= 300 && score <= 850) {
        assignScore(scores, bureau, score);
      }
    }
  });

  // Text patterns fallback
  const bureauMatches = text.matchAll(MSIQ_PATTERNS.score);
  for (const m of bureauMatches) {
    const score = parseInt(m[1]);
    if (score >= 300 && score <= 850) {
      const bureau = m[0].toLowerCase();
      if (bureau.includes('transunion') && !scores.transunion) scores.transunion = score;
      else if (bureau.includes('experian') && !scores.experian) scores.experian = score;
      else if (bureau.includes('equifax') && !scores.equifax) scores.equifax = score;
    }
  }

  // FICO fallback
  if (!scores.transunion && !scores.experian && !scores.equifax) {
    const ficoMatch = text.match(MSIQ_PATTERNS.ficoScore);
    if (ficoMatch) {
      const score = parseInt(ficoMatch[1]);
      if (score >= 300 && score <= 850) {
        scores.transunion = score;
        scores.experian = score;
        scores.equifax = score;
      }
    }
  }

  return scores;
}

function extractMSIQConsumerProfile($: cheerio.CheerioAPI, text: string): StandardizedConsumerProfile {
  const profile: StandardizedConsumerProfile = {
    names: [],
    addresses: [],
    employers: [],
  };

  $(MSIQ_SELECTORS.personalSection).each((_, section) => {
    const sectionEl = $(section);
    
    // Names
    sectionEl.find(MSIQ_SELECTORS.fullName + ', .name').each((_, el) => {
      const nameText = $(el).text().trim();
      if (nameText.length > 2 && nameText.length < 80) {
        const parts = nameText.split(/\s+/);
        if (parts.length >= 2) {
          profile.names.push({
            firstName: parts[0],
            middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined,
            lastName: parts[parts.length - 1],
            bureau: getBureauContext($, el),
          });
        }
      }
    });

    // Addresses
    sectionEl.find(MSIQ_SELECTORS.addressInfo + ', .address').each((_, el) => {
      const addrText = $(el).text().trim();
      const parsed = parseAddressString(addrText);
      if (parsed) {
        profile.addresses.push({ ...parsed, bureau: getBureauContext($, el) });
      }
    });
  });

  // SSN
  const ssnMatch = text.match(/(?:SSN|Social)[:\s]*(?:XXX-XX-)?(\d{4})/i);
  if (ssnMatch) profile.ssnLast4 = ssnMatch[1];

  // DOB
  const dobMatch = text.match(/(?:DOB|Birth\s*Date)[:\s]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
  if (dobMatch) profile.dateOfBirth = toDate(dobMatch[1]);

  return profile;
}

function extractMSIQAccounts($: cheerio.CheerioAPI, text: string): ParsedAccount[] {
  const accounts: ParsedAccount[] = [];
  const seen = new Set<string>();

  // Entry-based extraction
  $(`${MSIQ_SELECTORS.accountEntry}, ${MSIQ_SELECTORS.accountBlock}`).each((_, el) => {
    const account = parseAccountEntry($, el as Element);
    if (account && account.creditorName) {
      const key = makeKey(account.creditorName, account.accountNumber);
      if (!seen.has(key)) {
        seen.add(key);
        accounts.push(account);
      }
    }
  });

  // List container children
  if (accounts.length === 0) {
    $(MSIQ_SELECTORS.accountList).children().each((_, el) => {
      const account = parseAccountEntry($, el as Element);
      if (account && account.creditorName) {
        const key = makeKey(account.creditorName, account.accountNumber);
        if (!seen.has(key)) {
          seen.add(key);
          accounts.push(account);
        }
      }
    });
  }

  // Table fallback
  if (accounts.length === 0) {
    $('table').each((_, table) => {
      const tableText = $(table).text().toLowerCase();
      if (tableText.includes('account') || tableText.includes('creditor') || tableText.includes('balance')) {
        $(table).find('tbody tr, tr').each((_, row) => {
          if ($(row).find('th').length > 0) return;
          const account = parseTableRow($, row as Element);
          if (account && account.creditorName) {
            const key = makeKey(account.creditorName, account.accountNumber);
            if (!seen.has(key)) {
              seen.add(key);
              accounts.push(account);
            }
          }
        });
      }
    });
  }

  // Text fallback
  if (accounts.length === 0) {
    accounts.push(...parseTextAccounts(text));
  }

  return accounts;
}

function parseAccountEntry($: cheerio.CheerioAPI, el: Element): ParsedAccount | null {
  const elQuery = $(el);
  const elText = elQuery.text();

  // Creditor name
  let creditorName = elQuery.find(MSIQ_SELECTORS.creditorField).first().text().trim();
  if (!creditorName) {
    creditorName = elQuery.find('strong, b, h4, .title').first().text().trim();
  }
  if (!creditorName || creditorName.length < 2 || creditorName.length > 100) return null;

  // Fields
  const accountNumber = elQuery.find(MSIQ_SELECTORS.accountNumField).text().trim() ||
    elText.match(MSIQ_PATTERNS.accountNum)?.[1];
  const balanceText = elQuery.find(MSIQ_SELECTORS.balanceField).text() ||
    elText.match(MSIQ_PATTERNS.balance)?.[1];
  const limitText = elQuery.find(MSIQ_SELECTORS.limitField).text() ||
    elText.match(MSIQ_PATTERNS.limit)?.[1];
  const statusText = elQuery.find(MSIQ_SELECTORS.statusField).text() || elText;
  const paymentText = elQuery.find(MSIQ_SELECTORS.paymentField).text() || statusText;
  const typeText = elQuery.find(MSIQ_SELECTORS.typeField).text();
  const openedText = elQuery.find(MSIQ_SELECTORS.openedField).text();
  const reportedText = elQuery.find(MSIQ_SELECTORS.reportedField).text();

  const account: ParsedAccount = {
    creditorName,
    accountNumber: accountNumber || undefined,
    accountType: typeText || inferAccountType(elText),
    accountStatus: inferStatus(statusText),
    balance: toMoney(balanceText),
    creditLimit: toMoney(limitText),
    paymentStatus: inferPaymentStatus(paymentText),
    dateOpened: toDate(openedText),
    dateReported: toDate(reportedText),
    isNegative: false,
    riskLevel: 'low',
  };

  account.isNegative = isAccountNegative(account as Partial<StandardizedAccount>);
  account.riskLevel = calculateRiskLevel(account as Partial<StandardizedAccount>);

  return account;
}

function parseTableRow($: cheerio.CheerioAPI, row: Element): ParsedAccount | null {
  const cells = $(row).find('td');
  if (cells.length < 2) return null;

  const creditorName = $(cells[0]).text().trim();
  if (!creditorName || creditorName.length < 2) return null;

  const rowText = $(row).text();
  
  // Try to find balance and limit in cells
  let balance: number | undefined;
  let creditLimit: number | undefined;
  
  cells.each((_, cell) => {
    const cellText = $(cell).text();
    const moneyMatch = cellText.match(/\$?([\d,]+(?:\.\d{2})?)/);
    if (moneyMatch) {
      const val = toMoney(moneyMatch[1]);
      if (val !== undefined) {
        if (!balance) balance = val;
        else if (!creditLimit) creditLimit = val;
      }
    }
  });

  const account: ParsedAccount = {
    creditorName: creditorName.substring(0, 100),
    balance,
    creditLimit,
    accountStatus: inferStatus(rowText),
    paymentStatus: inferPaymentStatus(rowText),
    isNegative: false,
    riskLevel: 'low',
  };

  account.isNegative = isAccountNegative(account as Partial<StandardizedAccount>);
  account.riskLevel = calculateRiskLevel(account as Partial<StandardizedAccount>);

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
      accountNumber: section.match(MSIQ_PATTERNS.accountNum)?.[1],
      balance: toMoney(section.match(MSIQ_PATTERNS.balance)?.[1]),
      creditLimit: toMoney(section.match(MSIQ_PATTERNS.limit)?.[1]),
      accountStatus: inferStatus(section),
      paymentStatus: inferPaymentStatus(section),
      isNegative: false,
      riskLevel: 'low',
    };

    account.isNegative = isAccountNegative(account as Partial<StandardizedAccount>);
    account.riskLevel = calculateRiskLevel(account as Partial<StandardizedAccount>);
    accounts.push(account);
  }

  return accounts;
}

function extractMSIQNegativeItems(accounts: ParsedAccount[], $: cheerio.CheerioAPI, _text: string): ParsedNegativeItem[] {
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

  // From alert sections
  $(`${MSIQ_SELECTORS.alertSection}, ${MSIQ_SELECTORS.collectionAlert}, ${MSIQ_SELECTORS.derogatorySection}`)
    .find('.item, tr, li').each((_, el) => {
      const elText = $(el).text();
      const nameMatch = elText.match(/([A-Z][A-Za-z0-9\s&.,'-]{2,50})/);
      const amountMatch = elText.match(/\$?([\d,]+(?:\.\d{2})?)/);

      if (nameMatch) {
        const name = nameMatch[1].trim();
        if (!items.some(i => i.creditorName.toLowerCase() === name.toLowerCase())) {
          items.push({
            itemType: 'collection',
            creditorName: name,
            amount: toMoney(amountMatch?.[1]),
            riskSeverity: 'high',
          });
        }
      }
    });

  return items;
}

function extractMSIQInquiries($: cheerio.CheerioAPI, text: string): ParsedInquiry[] {
  const inquiries: ParsedInquiry[] = [];

  $(MSIQ_SELECTORS.inquirySection).find(MSIQ_SELECTORS.inquiryEntry + ', tr, .item').each((_, el) => {
    const elText = $(el).text();
    const nameMatch = elText.match(/([A-Z][A-Za-z0-9\s&.,'-]+)/);
    const dateMatch = elText.match(MSIQ_PATTERNS.date);

    if (nameMatch) {
      inquiries.push({
        creditorName: nameMatch[1].trim(),
        inquiryDate: dateMatch ? toDate(dateMatch[1]) : undefined,
      });
    }
  });

  // Fallback
  if (inquiries.length === 0) {
    const section = text.match(/(?:Inquiries|Hard\s*Inquiries)[\s\S]*?(?=Account|Public|$)/i);
    if (section) {
      const matches = section[0].matchAll(/([A-Z][A-Za-z0-9\s&.,'-]+)\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g);
      for (const m of matches) {
        inquiries.push({ creditorName: m[1].trim(), inquiryDate: toDate(m[2]) });
      }
    }
  }

  return inquiries;
}

function calculateMSIQSummary(accounts: ParsedAccount[]): ParsedCreditData['summary'] {
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
function assignScore(scores: ParsedCreditData['scores'], text: string, score: number) {
  const t = text.toLowerCase();
  if (t.includes('transunion') || t.includes(' tu')) scores.transunion = score;
  else if (t.includes('experian') || t.includes(' ex')) scores.experian = score;
  else if (t.includes('equifax') || t.includes(' eq')) scores.equifax = score;
}

function getBureauContext($: cheerio.CheerioAPI, el: Element): 'transunion' | 'experian' | 'equifax' {
  const ctx = $(el).closest('[data-bureau]').attr('data-bureau') || $(el).parents().slice(0, 5).text().toLowerCase();
  if (ctx.includes('transunion')) return 'transunion';
  if (ctx.includes('experian')) return 'experian';
  if (ctx.includes('equifax')) return 'equifax';
  return 'transunion';
}

function makeKey(creditor: string, accountNum?: string): string {
  return `${creditor.toLowerCase().replace(/\s+/g, '')}-${accountNum || ''}`;
}

function parseAddressString(text: string): { street: string; city: string; state: string; zipCode: string } | null {
  const m = text.match(/(.+?),\s*(.+?),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)/i);
  return m ? { street: m[1].trim(), city: m[2].trim(), state: m[3].toUpperCase(), zipCode: m[4] } : null;
}

function toMoney(val: string | undefined | null): number | undefined {
  if (!val) return undefined;
  const n = parseFloat(val.replace(/[$,]/g, ''));
  return isNaN(n) ? undefined : Math.round(n * 100);
}

function toDate(str: string | undefined | null): Date | undefined {
  if (!str) return undefined;
  const d = new Date(str.replace(/-/g, '/'));
  return isNaN(d.getTime()) ? undefined : d;
}

function inferStatus(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('closed')) return 'closed';
  if (t.includes('collection')) return 'collection';
  if (t.includes('charge') && t.includes('off')) return 'charge_off';
  if (t.includes('paid')) return 'paid';
  return 'open';
}

function inferPaymentStatus(text: string): string {
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

function inferAccountType(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('credit card') || t.includes('revolving')) return 'credit_card';
  if (t.includes('auto') || t.includes('vehicle')) return 'auto_loan';
  if (t.includes('mortgage')) return 'mortgage';
  if (t.includes('student')) return 'student_loan';
  if (t.includes('collection')) return 'collection';
  return 'other';
}

function getItemType(account: ParsedAccount): string {
  if (account.accountStatus === 'collection') return 'collection';
  if (account.accountStatus === 'charge_off') return 'charge_off';
  if (account.paymentStatus?.includes('late')) return 'late_payment';
  return 'derogatory';
}

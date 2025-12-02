// IdentityIQ Credit Report Parser
// Handles HTML reports exported from IdentityIQ credit monitoring service
// Ported from PHP ParserController with IIQ-specific DOM selectors

import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type {
  ParsedCreditData,
  ParsedAccount,
  ParsedNegativeItem,
  ParsedInquiry,
  BureauSummary,
  BureauMetrics,
  BureauCreditUtilization,
  CreditUtilization,
  DerogatoryAccount,
  PublicRecord,
  ExtendedParsedCreditData,
  PersonalInfoPerBureau,
  BureauPersonalInfo,
} from './pdf-parser';
import {
  StandardizedAccount,
  StandardizedConsumerProfile,
  isAccountNegative,
  calculateRiskLevel,
} from './metro2-mapping';

// IdentityIQ-specific CSS selectors (matching actual HTML structure)
const IIQ_SELECTORS = {
  // Main sections
  creditScoreSection: '#CreditScore',
  summarySection: '#Summary',
  accountHistorySection: 'address-history',
  inquiriesSection: '#Inquiries',
  publicRecordsSection: '#PublicInformation',
  
  // Table structures
  fourColumnTable: 'table.rpt_content_table.rpt_table4column',
  accountTable: 'table.crPrint.ng-scope',
  dataTable: 'table.rpt_content_table.rpt_content_header.rpt_table4column.ng-scope',
  contactsTable: 'table.rpt_content_table.rpt_content_header.rpt_content_contacts',
  
  // Bureau header classes
  headerTransunion: '.headerTUC',
  headerExperian: '.headerEXP',
  headerEquifax: '.headerEQF',
  
  // Cell classes
  labelCell: 'td.label',
  infoCell: 'td.info',
  
  // Account headers
  accountHeader: 'div.sub_header.ng-binding.ng-scope',
  accountHeaderAlt: 'div.sub_header.ng-binding',
  
  // Content wrappers
  contentWrapper: '.rpt_content_wrapper',
  fullReportHeader: '.rpt_fullReport_header',
};

// Derogatory detection patterns (from PHP)
const DEROGATORY_PATTERNS = [
  'collection/chargeoff',
  'chargeoff',
  'charge off',
  'late 30',
  'late 60',
  'late 90',
  'late 120',
  'late 150',
  'late 180',
];

// Bureau column indices (0-based, column 0 is label)
const BUREAU_COLUMNS = {
  transunion: 1,
  experian: 2,
  equifax: 3,
};

export function parseIdentityIQReport(html: string): ExtendedParsedCreditData {
  const $ = cheerio.load(html);
  const text = $.text();

  // Extract all data using IIQ-specific methods
  const scores = extractIIQScores($);
  const bureauSummary = extractBureauSummary($);
  const bureauPersonalInfo = extractBureauPersonalInfo($);
  const consumerProfile = extractIIQConsumerProfile($);
  const { accounts, derogatoryAccounts } = extractIIQAccounts($);
  const creditUtilization = calculateCreditUtilization($);
  const publicRecords = extractPublicRecords($);
  const inquiries = extractIIQInquiries($);
  const negativeItems = buildNegativeItems(derogatoryAccounts, accounts);
  const summary = calculateIIQSummary(accounts, bureauSummary);

  return {
    scores,
    accounts,
    negativeItems,
    inquiries,
    summary,
    rawText: text,
    consumerProfile,
    bureauSummary,
    bureauPersonalInfo,
    creditUtilization,
    derogatoryAccounts,
    publicRecords,
  } as ExtendedParsedCreditData;
}

function extractIIQScores($: cheerio.CheerioAPI): ParsedCreditData['scores'] {
  const scores: ParsedCreditData['scores'] = {};

  // Find the Credit Score section
  const $creditScoreSection = $(IIQ_SELECTORS.creditScoreSection);
  
  if ($creditScoreSection.length > 0) {
    // Find the 4-column table within the credit score section
    $creditScoreSection.find(IIQ_SELECTORS.fourColumnTable).each((_, table) => {
      const $table = $(table);
      
      $table.find('tr').each((_, row) => {
        const $row = $(row);
        const $cells = $row.find('td');
        
        if ($cells.length >= 4) {
          const labelText = $($cells[0]).text().trim().toLowerCase();
          
          if (labelText.includes('credit score')) {
            // Extract scores from each bureau column
            const tuScore = parseScore($($cells[BUREAU_COLUMNS.transunion]).text());
            const expScore = parseScore($($cells[BUREAU_COLUMNS.experian]).text());
            const eqScore = parseScore($($cells[BUREAU_COLUMNS.equifax]).text());
            
            if (tuScore) scores.transunion = tuScore;
            if (expScore) scores.experian = expScore;
            if (eqScore) scores.equifax = eqScore;
          }
        }
      });
    });
  }

  // Fallback: search all 4-column tables for credit score row
  if (!scores.transunion && !scores.experian && !scores.equifax) {
    $(IIQ_SELECTORS.fourColumnTable).each((_, table) => {
      const $table = $(table);
      
      $table.find('tr').each((_, row) => {
        const $row = $(row);
        const $cells = $row.find('td');
        
        if ($cells.length >= 4) {
          const labelText = $($cells[0]).text().trim().toLowerCase();
          
          if (labelText.includes('credit score') && !labelText.includes('factor')) {
            const tuScore = parseScore($($cells[1]).text());
            const expScore = parseScore($($cells[2]).text());
            const eqScore = parseScore($($cells[3]).text());
            
            if (tuScore && !scores.transunion) scores.transunion = tuScore;
            if (expScore && !scores.experian) scores.experian = expScore;
            if (eqScore && !scores.equifax) scores.equifax = eqScore;
          }
        }
      });
    });
  }

  return scores;
}

function extractBureauSummary($: cheerio.CheerioAPI): BureauSummary {
  const createEmptyMetrics = (): BureauMetrics => ({
    creditScore: undefined,
    lenderRank: undefined,
    scoreScale: undefined,
    reportDate: undefined,
    totalAccounts: 0,
    openAccounts: 0,
    closedAccounts: 0,
    delinquent: 0,
    derogatory: 0,
    collection: 0,
    balances: 0,
    payments: 0,
    publicRecords: 0,
    inquiries: 0,
  });

  const summary: BureauSummary = {
    transunion: createEmptyMetrics(),
    experian: createEmptyMetrics(),
    equifax: createEmptyMetrics(),
  };

  // Extract Credit Score, Lender Rank, Score Scale from Credit Score section
  extractCreditScoreData($, summary);
  
  // Extract Report Date from Personal Information section
  extractReportDates($, summary);

  // Find the Summary section for account counts
  const $summarySection = $(IIQ_SELECTORS.summarySection).closest(IIQ_SELECTORS.contentWrapper);
  
  if ($summarySection.length === 0) {
    // Fallback: find by header text
    $(IIQ_SELECTORS.contentWrapper).each((_, wrapper) => {
      const headerText = $(wrapper).find(IIQ_SELECTORS.fullReportHeader).text().toLowerCase();
      if (headerText.includes('summary')) {
        extractSummaryFromTable($, $(wrapper), summary);
      }
    });
  } else {
    extractSummaryFromTable($, $summarySection, summary);
  }

  return summary;
}

function extractCreditScoreData($: cheerio.CheerioAPI, summary: BureauSummary): void {
  const $creditScoreSection = $(IIQ_SELECTORS.creditScoreSection).closest(IIQ_SELECTORS.contentWrapper);
  
  if ($creditScoreSection.length === 0) return;
  
  $creditScoreSection.find(IIQ_SELECTORS.fourColumnTable).each((_, table) => {
    $(table).find('tr').each((_, row) => {
      const $cells = $(row).find('td');
      
      if ($cells.length >= 4) {
        const labelText = $($cells[0]).text().trim().toLowerCase();
        
        if (labelText.includes('credit score') && !labelText.includes('factor')) {
          summary.transunion.creditScore = parseScore($($cells[1]).text());
          summary.experian.creditScore = parseScore($($cells[2]).text());
          summary.equifax.creditScore = parseScore($($cells[3]).text());
        } else if (labelText.includes('lender rank')) {
          summary.transunion.lenderRank = cleanText($($cells[1]).text());
          summary.experian.lenderRank = cleanText($($cells[2]).text());
          summary.equifax.lenderRank = cleanText($($cells[3]).text());
        } else if (labelText.includes('score scale')) {
          summary.transunion.scoreScale = cleanText($($cells[1]).text());
          summary.experian.scoreScale = cleanText($($cells[2]).text());
          summary.equifax.scoreScale = cleanText($($cells[3]).text());
        }
      }
    });
  });
}

function extractReportDates($: cheerio.CheerioAPI, summary: BureauSummary): void {
  // Report dates are in the Personal Information section
  $(IIQ_SELECTORS.contentWrapper).each((_, wrapper) => {
    const $wrapper = $(wrapper);
    const headerText = $wrapper.find(IIQ_SELECTORS.fullReportHeader).text().toLowerCase();
    
    if (headerText.includes('personal information')) {
      $wrapper.find(IIQ_SELECTORS.fourColumnTable).each((_, table) => {
        $(table).find('tr').each((_, row) => {
          const $cells = $(row).find('td');
          
          if ($cells.length >= 4) {
            const labelText = $($cells[0]).text().trim().toLowerCase();
            
            if (labelText.includes('credit report date') || labelText.includes('report date')) {
              summary.transunion.reportDate = cleanText($($cells[1]).text());
              summary.experian.reportDate = cleanText($($cells[2]).text());
              summary.equifax.reportDate = cleanText($($cells[3]).text());
            }
          }
        });
      });
    }
  });
}

function extractBureauPersonalInfo($: cheerio.CheerioAPI): BureauPersonalInfo {
  const createEmptyPersonalInfo = (): PersonalInfoPerBureau => ({
    name: undefined,
    alsoKnownAs: [],
    formerName: [],
    dateOfBirth: undefined,
    currentAddress: undefined,
    previousAddresses: [],
    employers: [],
  });

  const personalInfo: BureauPersonalInfo = {
    transunion: createEmptyPersonalInfo(),
    experian: createEmptyPersonalInfo(),
    equifax: createEmptyPersonalInfo(),
  };

  // Find Personal Information section
  $(IIQ_SELECTORS.contentWrapper).each((_, wrapper) => {
    const $wrapper = $(wrapper);
    const headerText = $wrapper.find(IIQ_SELECTORS.fullReportHeader).text().toLowerCase();
    
    if (headerText.includes('personal information')) {
      $wrapper.find(IIQ_SELECTORS.fourColumnTable).each((_, table) => {
        $(table).find('tr').each((_, row) => {
          const $cells = $(row).find('td');
          
          if ($cells.length >= 4) {
            const labelText = $($cells[0]).text().trim().toLowerCase();
            
            // Extract Name
            if (labelText === 'name:') {
              personalInfo.transunion.name = cleanText($($cells[1]).text());
              personalInfo.experian.name = cleanText($($cells[2]).text());
              personalInfo.equifax.name = cleanText($($cells[3]).text());
            }
            
            // Extract Also Known As (AKA)
            if (labelText.includes('also known as') || labelText === 'aka:') {
              const tuAka = cleanText($($cells[1]).text());
              const expAka = cleanText($($cells[2]).text());
              const eqAka = cleanText($($cells[3]).text());
              if (tuAka) personalInfo.transunion.alsoKnownAs?.push(tuAka);
              if (expAka) personalInfo.experian.alsoKnownAs?.push(expAka);
              if (eqAka) personalInfo.equifax.alsoKnownAs?.push(eqAka);
            }
            
            // Extract Former Name
            if (labelText.includes('former')) {
              const tuFormer = cleanText($($cells[1]).text());
              const expFormer = cleanText($($cells[2]).text());
              const eqFormer = cleanText($($cells[3]).text());
              if (tuFormer) personalInfo.transunion.formerName?.push(tuFormer);
              if (expFormer) personalInfo.experian.formerName?.push(expFormer);
              if (eqFormer) personalInfo.equifax.formerName?.push(eqFormer);
            }
            
            // Extract Date of Birth
            if (labelText.includes('date of birth') || labelText.includes('birth')) {
              personalInfo.transunion.dateOfBirth = cleanText($($cells[1]).text());
              personalInfo.experian.dateOfBirth = cleanText($($cells[2]).text());
              personalInfo.equifax.dateOfBirth = cleanText($($cells[3]).text());
            }
            
            // Extract Current Address
            if (labelText.includes('current address')) {
              personalInfo.transunion.currentAddress = cleanText($($cells[1]).text());
              personalInfo.experian.currentAddress = cleanText($($cells[2]).text());
              personalInfo.equifax.currentAddress = cleanText($($cells[3]).text());
            }
            
            // Extract Previous Addresses
            if (labelText.includes('previous address')) {
              const tuPrevAddrs = splitMultipleAddresses($($cells[1]).text());
              const expPrevAddrs = splitMultipleAddresses($($cells[2]).text());
              const eqPrevAddrs = splitMultipleAddresses($($cells[3]).text());
              personalInfo.transunion.previousAddresses?.push(...tuPrevAddrs);
              personalInfo.experian.previousAddresses?.push(...expPrevAddrs);
              personalInfo.equifax.previousAddresses?.push(...eqPrevAddrs);
            }
            
            // Extract Employers
            if (labelText.includes('employer')) {
              const tuEmp = cleanText($($cells[1]).text());
              const expEmp = cleanText($($cells[2]).text());
              const eqEmp = cleanText($($cells[3]).text());
              if (tuEmp) personalInfo.transunion.employers?.push(tuEmp);
              if (expEmp) personalInfo.experian.employers?.push(expEmp);
              if (eqEmp) personalInfo.equifax.employers?.push(eqEmp);
            }
          }
        });
      });
    }
  });

  return personalInfo;
}

function extractSummaryFromTable(
  $: cheerio.CheerioAPI,
  $container: cheerio.Cheerio<AnyNode>,
  summary: BureauSummary
): void {
  const fieldMappings: Record<string, keyof BureauMetrics> = {
    'total accounts': 'totalAccounts',
    'open accounts': 'openAccounts',
    'closed accounts': 'closedAccounts',
    'delinquent': 'delinquent',
    'derogatory': 'derogatory',
    'collection': 'collection',
    'balances': 'balances',
    'payments': 'payments',
    'public records': 'publicRecords',
    'inquiries': 'inquiries',
  };

  $container.find(IIQ_SELECTORS.fourColumnTable).each((_, table) => {
    $(table).find('tr').each((_, row) => {
      const $cells = $(row).find('td');
      
      if ($cells.length >= 4) {
        const labelText = $($cells[0]).text().trim().toLowerCase();
        
        for (const [pattern, field] of Object.entries(fieldMappings)) {
          if (labelText.includes(pattern)) {
            // Balance and payment fields need to be converted to cents
            const isMoney = field === 'balances' || field === 'payments';
            const tuValue = parseNumericValue($($cells[1]).text(), isMoney);
            const expValue = parseNumericValue($($cells[2]).text(), isMoney);
            const eqValue = parseNumericValue($($cells[3]).text(), isMoney);
            
            summary.transunion[field] = tuValue as never;
            summary.experian[field] = expValue as never;
            summary.equifax[field] = eqValue as never;
            break;
          }
        }
      }
    });
  });
}

function extractIIQConsumerProfile($: cheerio.CheerioAPI): StandardizedConsumerProfile {
  const profile: StandardizedConsumerProfile = {
    names: [],
    addresses: [],
    employers: [],
  };

  // Find Personal Information section
  $(IIQ_SELECTORS.contentWrapper).each((_, wrapper) => {
    const $wrapper = $(wrapper);
    const headerText = $wrapper.find(IIQ_SELECTORS.fullReportHeader).text().toLowerCase();
    
    if (headerText.includes('personal information')) {
      $wrapper.find(IIQ_SELECTORS.fourColumnTable).each((_, table) => {
        $(table).find('tr').each((_, row) => {
          const $cells = $(row).find('td');
          
          if ($cells.length >= 4) {
            const labelText = $($cells[0]).text().trim().toLowerCase();
            
            // Extract names
            if (labelText === 'name:') {
              for (let i = 1; i <= 3; i++) {
                // Clean up the text - remove extra whitespace and &nbsp;
                const nameText = $($cells[i]).text()
                  .replace(/\u00A0/g, ' ')  // Replace &nbsp; with space
                  .replace(/\s+/g, ' ')      // Collapse multiple spaces
                  .trim();
                if (nameText && nameText !== '-') {
                  const nameParts = parseFullName(nameText);
                  if (nameParts.firstName) {
                    profile.names.push({
                      ...nameParts,
                      bureau: getBureauName(i),
                    });
                  }
                }
              }
            }
            
            // Extract addresses (current)
            if (labelText.includes('current address')) {
              for (let i = 1; i <= 3; i++) {
                const addressText = $($cells[i]).text().trim();
                if (addressText && addressText !== '-') {
                  const address = parseAddress(addressText);
                  if (address) {
                    profile.addresses.push({
                      ...address,
                      addressType: 'current',
                      bureau: getBureauName(i),
                    });
                  }
                }
              }
            }
            
            // Extract DOB
            if (labelText.includes('date of birth') || labelText.includes('birth')) {
              for (let i = 1; i <= 3; i++) {
                const dobText = $($cells[i]).text().trim();
                if (dobText && dobText !== '-' && !profile.dateOfBirth) {
                  // Try to parse various date formats
                  const dob = parseDate(dobText);
                  if (dob) {
                    profile.dateOfBirth = dob;
                    break;
                  }
                }
              }
            }
            
            // Extract employers
            if (labelText.includes('employer')) {
              for (let i = 1; i <= 3; i++) {
                const employerText = $($cells[i]).text().trim();
                if (employerText && employerText !== '-') {
                  profile.employers.push({
                    name: employerText,
                    bureau: getBureauName(i),
                  });
                }
              }
            }
          }
        });
      });
    }
  });

  return profile;
}

function extractIIQAccounts($: cheerio.CheerioAPI): {
  accounts: ParsedAccount[];
  derogatoryAccounts: DerogatoryAccount[];
} {
  const accounts: ParsedAccount[] = [];
  const derogatoryAccounts: DerogatoryAccount[] = [];
  const processedCreditors = new Set<string>();

  // Find all account tables within address-history elements
  $(IIQ_SELECTORS.accountHistorySection).each((_, historyEl) => {
    const $history = $(historyEl);
    
    // Find tables with class "crPrint ng-scope"
    $history.find('table.crPrint.ng-scope, table.crPrint').each((_, accountTable) => {
      const $accountTable = $(accountTable);
      
      // Get account/creditor name from header
      let creditorName = '';
      $accountTable.find('div.sub_header').each((_, header) => {
        const headerText = $(header).text().trim();
        if (headerText && !headerText.toLowerCase().includes('account #')) {
          creditorName = headerText;
        }
      });
      
      if (!creditorName) {
        // Try alternative header location
        creditorName = $accountTable.prev('div.sub_header').text().trim();
      }
      
      if (!creditorName || processedCreditors.has(creditorName)) return;
      processedCreditors.add(creditorName);

      // Initialize account data for each bureau
      const accountData: Record<string, Record<string, string>> = {
        transunion: {},
        experian: {},
        equifax: {},
      };

      // Find the data table within this account
      $accountTable.find('table.rpt_content_table.rpt_table4column').each((_, dataTable) => {
        const $dataTable = $(dataTable);
        let rowIndex = 0;
        
        $dataTable.find('tr').each((_, row) => {
          const $row = $(row);
          const $cells = $row.find('td');
          
          if ($cells.length >= 4) {
            const labelText = $($cells[0]).text().trim().toLowerCase();
            
            // Extract values for each bureau
            const tuValue = $($cells[1]).text().trim();
            const expValue = $($cells[2]).text().trim();
            const eqValue = $($cells[3]).text().trim();
            
            // Map by label text
            if (labelText.includes('account #')) {
              accountData.transunion.accountNumber = tuValue;
              accountData.experian.accountNumber = expValue;
              accountData.equifax.accountNumber = eqValue;
            } else if (labelText.includes('account type') && !labelText.includes('detail')) {
              accountData.transunion.accountType = tuValue;
              accountData.experian.accountType = expValue;
              accountData.equifax.accountType = eqValue;
            } else if (labelText.includes('account status')) {
              accountData.transunion.accountStatus = tuValue;
              accountData.experian.accountStatus = expValue;
              accountData.equifax.accountStatus = eqValue;
            } else if (labelText === 'balance:') {
              accountData.transunion.balance = tuValue;
              accountData.experian.balance = expValue;
              accountData.equifax.balance = eqValue;
            } else if (labelText.includes('credit limit')) {
              accountData.transunion.creditLimit = tuValue;
              accountData.experian.creditLimit = expValue;
              accountData.equifax.creditLimit = eqValue;
            } else if (labelText.includes('high credit')) {
              accountData.transunion.highCredit = tuValue;
              accountData.experian.highCredit = expValue;
              accountData.equifax.highCredit = eqValue;
            } else if (labelText.includes('date opened')) {
              accountData.transunion.dateOpened = tuValue;
              accountData.experian.dateOpened = expValue;
              accountData.equifax.dateOpened = eqValue;
            } else if (labelText.includes('payment status')) {
              accountData.transunion.paymentStatus = tuValue;
              accountData.experian.paymentStatus = expValue;
              accountData.equifax.paymentStatus = eqValue;
            } else if (labelText.includes('monthly payment')) {
              accountData.transunion.monthlyPayment = tuValue;
              accountData.experian.monthlyPayment = expValue;
              accountData.equifax.monthlyPayment = eqValue;
            } else if (labelText.includes('past due')) {
              accountData.transunion.pastDue = tuValue;
              accountData.experian.pastDue = expValue;
              accountData.equifax.pastDue = eqValue;
            }
            
            rowIndex++;
          }
        });
      });

      // Check if this is a derogatory account
      const isDerogatoryAccount = checkIfDerogatory(accountData);
      
      if (isDerogatoryAccount) {
        const derogatoryAccount: DerogatoryAccount = {
          creditorName,
          uniqueStatus: buildUniqueStatus(accountData),
          transunion: {
            accountStatus: accountData.transunion.accountStatus,
            accountDate: accountData.transunion.dateOpened,
            paymentStatus: accountData.transunion.paymentStatus,
          },
          experian: {
            accountStatus: accountData.experian.accountStatus,
            accountDate: accountData.experian.dateOpened,
            paymentStatus: accountData.experian.paymentStatus,
          },
          equifax: {
            accountStatus: accountData.equifax.accountStatus,
            accountDate: accountData.equifax.dateOpened,
            paymentStatus: accountData.equifax.paymentStatus,
          },
        };
        derogatoryAccounts.push(derogatoryAccount);
      }

      // Create parsed accounts for each bureau that has data
      for (const bureau of ['transunion', 'experian', 'equifax'] as const) {
        const data = accountData[bureau];
        if (Object.keys(data).length > 0) {
          const account = createParsedAccount(creditorName, data, bureau);
          accounts.push(account);
        }
      }
    });
  });

  return { accounts, derogatoryAccounts };
}

function checkIfDerogatory(accountData: Record<string, Record<string, string>>): boolean {
  for (const bureau of ['transunion', 'experian', 'equifax']) {
    const data = accountData[bureau];
    const status = (data.accountStatus || '').toLowerCase();
    const paymentStatus = (data.paymentStatus || '').toLowerCase();
    
    if (status === 'derogatory') return true;
    
    for (const pattern of DEROGATORY_PATTERNS) {
      if (paymentStatus.includes(pattern)) return true;
    }
  }
  return false;
}

function buildUniqueStatus(accountData: Record<string, Record<string, string>>): string {
  const statuses = new Set<string>();
  
  for (const bureau of ['transunion', 'experian', 'equifax']) {
    const paymentStatus = accountData[bureau].paymentStatus;
    if (paymentStatus && paymentStatus !== '-') {
      statuses.add(paymentStatus);
    }
  }
  
  return Array.from(statuses).join(', ');
}

function createParsedAccount(
  creditorName: string,
  data: Record<string, string>,
  bureau: string
): ParsedAccount {
  const balance = parseMoneyValue(data.balance);
  const creditLimit = parseMoneyValue(data.creditLimit);
  const highCredit = parseMoneyValue(data.highCredit);
  
  const accountStatus = determineAccountStatus(data.accountStatus || '');
  const paymentStatus = determinePaymentStatus(data.paymentStatus || '');
  
  const account: ParsedAccount = {
    creditorName: creditorName.substring(0, 100),
    accountNumber: data.accountNumber !== '-' ? data.accountNumber : undefined,
    accountType: data.accountType !== '-' ? data.accountType : 'other',
    accountStatus,
    balance,
    creditLimit,
    highCredit,
    monthlyPayment: parseMoneyValue(data.monthlyPayment),
    pastDueAmount: parseMoneyValue(data.pastDue),
    paymentStatus,
    dateOpened: parseDate(data.dateOpened),
    bureau,
    isNegative: false,
    riskLevel: 'low',
  };

  // Calculate negative status and risk
  account.isNegative = isAccountNegative(account as unknown as Partial<StandardizedAccount>);
  account.riskLevel = calculateRiskLevel(account as unknown as Partial<StandardizedAccount>);

  return account;
}

function calculateCreditUtilization($: cheerio.CheerioAPI): BureauCreditUtilization {
  const createEmptyUtilization = (): CreditUtilization => ({
    balance: 0,
    limit: 0,
    percent: 0,
    rating: 'no_data',
  });

  const utilization: BureauCreditUtilization = {
    transunion: createEmptyUtilization(),
    experian: createEmptyUtilization(),
    equifax: createEmptyUtilization(),
    total: createEmptyUtilization(),
  };

  // Find all account tables and sum revolving accounts
  $(IIQ_SELECTORS.accountHistorySection).each((_, historyEl) => {
    const $history = $(historyEl);
    
    $history.find('table.crPrint.ng-scope, table.crPrint').each((_, accountTable) => {
      const $accountTable = $(accountTable);
      
      const accountData: Record<string, Record<string, string>> = {
        transunion: {},
        experian: {},
        equifax: {},
      };

      $accountTable.find('table.rpt_content_table.rpt_table4column').each((_, dataTable) => {
        $(dataTable).find('tr').each((_, row) => {
          const $cells = $(row).find('td');
          
          if ($cells.length >= 4) {
            const labelText = $($cells[0]).text().trim().toLowerCase();
            
            if (labelText.includes('account type') && !labelText.includes('detail')) {
              accountData.transunion.accountType = $($cells[1]).text().trim();
              accountData.experian.accountType = $($cells[2]).text().trim();
              accountData.equifax.accountType = $($cells[3]).text().trim();
            } else if (labelText.includes('account status')) {
              accountData.transunion.accountStatus = $($cells[1]).text().trim();
              accountData.experian.accountStatus = $($cells[2]).text().trim();
              accountData.equifax.accountStatus = $($cells[3]).text().trim();
            } else if (labelText === 'balance:') {
              accountData.transunion.balance = $($cells[1]).text().trim();
              accountData.experian.balance = $($cells[2]).text().trim();
              accountData.equifax.balance = $($cells[3]).text().trim();
            } else if (labelText.includes('credit limit')) {
              accountData.transunion.creditLimit = $($cells[1]).text().trim();
              accountData.experian.creditLimit = $($cells[2]).text().trim();
              accountData.equifax.creditLimit = $($cells[3]).text().trim();
            }
          }
        });
      });

      // Sum only revolving accounts that are open (matching PHP logic)
      for (const bureau of ['transunion', 'experian', 'equifax'] as const) {
        const data = accountData[bureau];
        const accountType = (data.accountType || '').toLowerCase();
        const accountStatus = (data.accountStatus || '').toLowerCase();
        
        if (accountType === 'revolving' && accountStatus === 'open') {
          const balance = parseMoneyValue(data.balance) || 0;
          const limit = parseMoneyValue(data.creditLimit) || 0;
          
          utilization[bureau].balance += balance;
          utilization[bureau].limit += limit;
        }
      }
    });
  });

  // Calculate percentages and ratings
  for (const bureau of ['transunion', 'experian', 'equifax'] as const) {
    if (utilization[bureau].limit > 0) {
      utilization[bureau].percent = Math.round(
        (utilization[bureau].balance / utilization[bureau].limit) * 100
      );
      utilization[bureau].rating = getUtilizationRating(utilization[bureau].percent);
    }
  }

  // Calculate total (average of all bureaus)
  const totalBalance = (utilization.transunion.balance + utilization.experian.balance + utilization.equifax.balance) / 3;
  const totalLimit = (utilization.transunion.limit + utilization.experian.limit + utilization.equifax.limit) / 3;
  
  utilization.total.balance = Math.round(totalBalance);
  utilization.total.limit = Math.round(totalLimit);
  
  if (totalLimit > 0) {
    utilization.total.percent = Math.round((totalBalance / totalLimit) * 100);
    utilization.total.rating = getUtilizationRating(utilization.total.percent);
  }

  return utilization;
}

function getUtilizationRating(percent: number): CreditUtilization['rating'] {
  if (percent >= 75) return 'very_poor';
  if (percent >= 50) return 'poor';
  if (percent >= 30) return 'fair';
  if (percent >= 10) return 'good';
  if (percent >= 0) return 'excellent';
  return 'no_data';
}

function extractPublicRecords($: cheerio.CheerioAPI): PublicRecord[] {
  const records: PublicRecord[] = [];

  const $publicRecordsSection = $(IIQ_SELECTORS.publicRecordsSection);
  
  if ($publicRecordsSection.length > 0) {
    $publicRecordsSection.find('table.rpt_content_table.rpt_table4column').each((_, table) => {
      let recordType = '';
      let recordStatus = '';
      let tuFiled = '';
      let expFiled = '';
      let eqFiled = '';
      
      $(table).find('tr').each((rowIdx, row) => {
        const $cells = $(row).find('td');
        
        if ($cells.length >= 4) {
          const labelText = $($cells[0]).text().trim().toLowerCase();
          
          // Row 1 typically has the type
          if (rowIdx === 1) {
            recordType = $($cells[1]).text().trim() || $($cells[2]).text().trim() || $($cells[3]).text().trim();
          }
          // Row 2 has status
          if (rowIdx === 2) {
            recordStatus = $($cells[1]).text().trim() || $($cells[2]).text().trim() || $($cells[3]).text().trim();
          }
          // Row 3 has filing dates per bureau
          if (rowIdx === 3) {
            tuFiled = $($cells[1]).text().trim();
            expFiled = $($cells[2]).text().trim();
            eqFiled = $($cells[3]).text().trim();
          }
        }
      });

      if (recordType && recordType !== '-') {
        records.push({
          type: recordType,
          status: recordStatus,
          transunionFiled: tuFiled !== '-' ? tuFiled : undefined,
          experianFiled: expFiled !== '-' ? expFiled : undefined,
          equifaxFiled: eqFiled !== '-' ? eqFiled : undefined,
        });
      }
    });
  }

  return records;
}

function extractIIQInquiries($: cheerio.CheerioAPI): ParsedInquiry[] {
  const inquiries: ParsedInquiry[] = [];

  const $inquiriesSection = $(IIQ_SELECTORS.inquiriesSection);
  
  if ($inquiriesSection.length === 0) {
    // Find by section header
    $(IIQ_SELECTORS.contentWrapper).each((_, wrapper) => {
      const headerText = $(wrapper).find(IIQ_SELECTORS.fullReportHeader).text().toLowerCase();
      if (headerText.includes('inquiries')) {
        extractInquiriesFromTable($, $(wrapper), inquiries);
      }
    });
  } else {
    extractInquiriesFromTable($, $inquiriesSection.closest(IIQ_SELECTORS.contentWrapper), inquiries);
  }

  return inquiries;
}

function extractInquiriesFromTable(
  $: cheerio.CheerioAPI,
  $container: cheerio.Cheerio<AnyNode>,
  inquiries: ParsedInquiry[]
): void {
  // Inquiries table has columns: Business, Business Type, Date, Bureau
  $container.find(IIQ_SELECTORS.contactsTable + ', table.rpt_content_table').each((_, table) => {
    const $table = $(table);
    let isInquiryTable = false;
    
    // Check if this is the inquiry table by looking at headers
    $table.find('tr').first().find('th, td').each((_, cell) => {
      const text = $(cell).text().toLowerCase();
      if (text.includes('business') || text.includes('inquiry')) {
        isInquiryTable = true;
      }
    });
    
    if (!isInquiryTable) return;
    
    $table.find('tr').each((rowIdx, row) => {
      if (rowIdx === 0) return; // Skip header row
      
      const $cells = $(row).find('td');
      
      if ($cells.length >= 3) {
        const businessName = $($cells[0]).text().trim();
        const businessType = $($cells[1]).text().trim();
        const dateText = $($cells[2]).text().trim();
        const bureau = $cells.length >= 4 ? $($cells[3]).text().trim() : undefined;
        
        if (businessName && businessName !== '-') {
          inquiries.push({
            creditorName: businessName,
            inquiryDate: parseDate(dateText),
            bureau: bureau !== '-' ? bureau?.toLowerCase() : undefined,
            inquiryType: businessType !== '-' ? businessType : undefined,
          });
        }
      }
    });
  });
}

function buildNegativeItems(
  derogatoryAccounts: DerogatoryAccount[],
  accounts: ParsedAccount[]
): ParsedNegativeItem[] {
  const negativeItems: ParsedNegativeItem[] = [];
  const addedCreditors = new Set<string>();

  // Add from derogatory accounts
  for (const derog of derogatoryAccounts) {
    if (!addedCreditors.has(derog.creditorName.toLowerCase())) {
      addedCreditors.add(derog.creditorName.toLowerCase());
      
      let itemType = 'derogatory';
      const status = derog.uniqueStatus.toLowerCase();
      
      if (status.includes('collection') || status.includes('chargeoff')) {
        itemType = 'collection';
      } else if (status.includes('late')) {
        itemType = 'late_payment';
      }

      negativeItems.push({
        itemType,
        creditorName: derog.creditorName,
        riskSeverity: itemType === 'collection' ? 'high' : 'medium',
      });
    }
  }

  // Add additional negative items from accounts
  for (const account of accounts) {
    if (account.isNegative && !addedCreditors.has(account.creditorName.toLowerCase())) {
      addedCreditors.add(account.creditorName.toLowerCase());
      
      let itemType = 'derogatory';
      if (account.accountStatus === 'collection') itemType = 'collection';
      else if (account.accountStatus === 'charge_off') itemType = 'charge_off';
      else if (account.paymentStatus?.includes('late')) itemType = 'late_payment';

      negativeItems.push({
        itemType,
        creditorName: account.creditorName,
        amount: account.balance,
        bureau: account.bureau,
        riskSeverity: account.riskLevel || 'medium',
      });
    }
  }

  return negativeItems;
}

function calculateIIQSummary(
  accounts: ParsedAccount[],
  bureauSummary: BureauSummary
): ParsedCreditData['summary'] {
  // Use bureau summary data if available
  if (bureauSummary.transunion.totalAccounts > 0) {
    // Average across bureaus
    const totalAccounts = Math.round(
      (bureauSummary.transunion.totalAccounts +
        bureauSummary.experian.totalAccounts +
        bureauSummary.equifax.totalAccounts) / 3
    );
    const openAccounts = Math.round(
      (bureauSummary.transunion.openAccounts +
        bureauSummary.experian.openAccounts +
        bureauSummary.equifax.openAccounts) / 3
    );
    const closedAccounts = Math.round(
      (bureauSummary.transunion.closedAccounts +
        bureauSummary.experian.closedAccounts +
        bureauSummary.equifax.closedAccounts) / 3
    );
    const totalDebt = Math.round(
      (bureauSummary.transunion.balances +
        bureauSummary.experian.balances +
        bureauSummary.equifax.balances) / 3
    );

    return {
      totalAccounts,
      openAccounts,
      closedAccounts,
      totalDebt,
      totalCreditLimit: 0,
      utilizationPercent: 0,
    };
  }

  // Fallback to calculating from accounts
  const uniqueAccounts = new Map<string, ParsedAccount>();
  for (const account of accounts) {
    const key = account.creditorName.toLowerCase();
    if (!uniqueAccounts.has(key)) {
      uniqueAccounts.set(key, account);
    }
  }

  const uniqueAccountList = Array.from(uniqueAccounts.values());
  const openAccountsList = uniqueAccountList.filter(a => a.accountStatus === 'open');
  const closedAccountsList = uniqueAccountList.filter(a => a.accountStatus === 'closed');

  let totalDebt = 0;
  let totalCreditLimit = 0;

  for (const account of uniqueAccountList) {
    if (account.balance) totalDebt += account.balance;
    if (account.creditLimit) totalCreditLimit += account.creditLimit;
  }

  const utilizationPercent = totalCreditLimit > 0
    ? Math.round((totalDebt / totalCreditLimit) * 100)
    : 0;

  return {
    totalAccounts: uniqueAccountList.length,
    openAccounts: openAccountsList.length,
    closedAccounts: closedAccountsList.length,
    totalDebt,
    totalCreditLimit,
    utilizationPercent,
  };
}

// Helper functions
function parseScore(text: string): number | undefined {
  const match = text.trim().match(/(\d{3})/);
  if (match) {
    const score = parseInt(match[1]);
    if (score >= 300 && score <= 850) {
      return score;
    }
  }
  return undefined;
}

function parseNumericValue(text: string, convertToCents: boolean = false): number {
  const cleaned = text.replace(/[$,]/g, '').trim();
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  // Convert to cents for monetary values to match system convention
  return convertToCents ? Math.round(parsed * 100) : Math.round(parsed * 100) / 100;
}

function parseMoneyValue(value: string | undefined | null): number | undefined {
  if (!value || value === '-') return undefined;
  const cleaned = value.replace(/[$,]/g, '').trim();
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return undefined;
  return Math.round(parsed * 100);
}

function parseDate(dateStr: string | undefined | null): Date | undefined {
  if (!dateStr || dateStr === '-') return undefined;
  
  // Clean the string and extract date pattern
  const cleaned = dateStr.replace(/\s+/g, ' ').trim();
  
  // Try to extract a date pattern (MM/DD/YYYY, M/D/YYYY, YYYY, etc.)
  const dateMatch = cleaned.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
  if (dateMatch) {
    const date = new Date(dateMatch[1]);
    if (!isNaN(date.getTime())) return date;
  }
  
  // Try year-only format
  const yearMatch = cleaned.match(/^(\d{4})$/);
  if (yearMatch) {
    const date = new Date(`${yearMatch[1]}-01-01`);
    if (!isNaN(date.getTime())) return date;
  }
  
  // Fallback to direct parsing
  const date = new Date(cleaned);
  return isNaN(date.getTime()) ? undefined : date;
}

function cleanText(text: string): string | undefined {
  const cleaned = text
    .replace(/\u00A0/g, ' ')  // Replace &nbsp;
    .replace(/\s+/g, ' ')      // Collapse whitespace
    .replace(/\s*-\s*$/, '')   // Remove trailing dash (empty column indicator)
    .trim();
  return cleaned && cleaned !== '-' ? cleaned : undefined;
}

function splitMultipleAddresses(text: string): string[] {
  // Clean the text first
  const cleaned = text
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*$/, '')
    .trim();
  
  if (!cleaned || cleaned === '-') return [];
  
  // Split on pattern: date followed by start of new address (street number)
  // Pattern: MM/YYYY followed by a number (start of next address)
  const addresses: string[] = [];
  const splitPattern = /(\d{2}\/\d{4})\s+(\d+\s)/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = splitPattern.exec(cleaned)) !== null) {
    // Include the date with the previous address
    const address = cleaned.substring(lastIndex, match.index + match[1].length).trim();
    if (address) addresses.push(address);
    lastIndex = match.index + match[1].length + 1; // Start after the date and space
  }
  
  // Add the remaining text as the last address
  const remaining = cleaned.substring(lastIndex).trim();
  if (remaining) addresses.push(remaining);
  
  // If no splits occurred, return the whole thing as one address
  if (addresses.length === 0 && cleaned) {
    addresses.push(cleaned);
  }
  
  return addresses;
}

function parseFullName(fullName: string): {
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
} {
  // Filter out empty strings and standalone dashes/placeholders
  const parts = fullName.trim().split(/\s+/).filter(p => p && p !== '-' && p !== '—');
  
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
    middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : undefined,
    lastName,
  };
}

function parseAddress(addressText: string): {
  street: string;
  city: string;
  state: string;
  zipCode: string;
} | null {
  // IIQ format: "Street\nCity, ST\nZip"
  const lines = addressText.split(/\n|<br\s*\/?>/i).map(l => l.trim()).filter(Boolean);
  
  if (lines.length >= 2) {
    const street = lines[0];
    const cityStateLine = lines[1];
    const zipLine = lines[2] || '';
    
    // Parse "City, ST" or "City, ST Zip"
    const cityStateMatch = cityStateLine.match(/([^,]+),\s*([A-Z]{2})/i);
    if (cityStateMatch) {
      const zipMatch = zipLine.match(/(\d{5}(?:-\d{4})?)/);
      return {
        street,
        city: cityStateMatch[1].trim(),
        state: cityStateMatch[2].toUpperCase(),
        zipCode: zipMatch ? zipMatch[1] : '',
      };
    }
  }
  
  // Fallback: single line format "Street, City, ST ZIP"
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

function getBureauName(columnIndex: number): 'transunion' | 'experian' | 'equifax' {
  if (columnIndex === 1) return 'transunion';
  if (columnIndex === 2) return 'experian';
  return 'equifax';
}

function determineAccountStatus(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('closed')) return 'closed';
  if (lower.includes('collection')) return 'collection';
  if (lower.includes('charge') && lower.includes('off')) return 'charge_off';
  if (lower.includes('derogatory')) return 'derogatory';
  if (lower.includes('paid')) return 'paid';
  if (lower.includes('transferred')) return 'transferred';
  if (lower.includes('open')) return 'open';
  return 'unknown';
}

function determinePaymentStatus(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('180') && lower.includes('late')) return '180_days_late';
  if (lower.includes('150') && lower.includes('late')) return '150_days_late';
  if (lower.includes('120') && lower.includes('late')) return '120_days_late';
  if (lower.includes('90') && lower.includes('late')) return '90_days_late';
  if (lower.includes('60') && lower.includes('late')) return '60_days_late';
  if (lower.includes('30') && lower.includes('late')) return '30_days_late';
  if (lower.includes('collection') || lower.includes('chargeoff')) return 'collection';
  if (lower.includes('current') || lower.includes('pays as agreed') || lower.includes('ok')) return 'current';
  return text || 'unknown';
}

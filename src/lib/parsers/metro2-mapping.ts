// Metro 2 Format Mapping - Industry standard credit reporting field definitions
// Reference: Consumer Data Industry Association (CDIA) Metro 2 Format

// Account Status Codes (Field 17A)
export const ACCOUNT_STATUS_CODES: Record<string, { code: string; description: string; isNegative: boolean }> = {
  '00': { code: '00', description: 'Unknown', isNegative: false },
  '05': { code: '05', description: 'Account transferred', isNegative: false },
  '11': { code: '11', description: 'Current', isNegative: false },
  '13': { code: '13', description: 'Paid or closed/zero balance', isNegative: false },
  '61': { code: '61', description: 'Paid in full - was a voluntary surrender', isNegative: true },
  '62': { code: '62', description: 'Paid in full - was a collection account', isNegative: true },
  '63': { code: '63', description: 'Paid in full - was a repossession', isNegative: true },
  '64': { code: '64', description: 'Paid in full - was a charge-off', isNegative: true },
  '65': { code: '65', description: 'Paid in full - was foreclosure', isNegative: true },
  '71': { code: '71', description: '30 days past due', isNegative: true },
  '78': { code: '78', description: '60 days past due', isNegative: true },
  '80': { code: '80', description: '90 days past due', isNegative: true },
  '82': { code: '82', description: '120 days past due', isNegative: true },
  '83': { code: '83', description: '150 days past due', isNegative: true },
  '84': { code: '84', description: '180 days past due', isNegative: true },
  '88': { code: '88', description: 'Claim filed with government', isNegative: true },
  '89': { code: '89', description: 'Deed in lieu of foreclosure', isNegative: true },
  '93': { code: '93', description: 'Account assigned to internal collections', isNegative: true },
  '94': { code: '94', description: 'Foreclosure completed', isNegative: true },
  '95': { code: '95', description: 'Voluntary surrender', isNegative: true },
  '96': { code: '96', description: 'Merchandise repossessed', isNegative: true },
  '97': { code: '97', description: 'Charge-off', isNegative: true },
};

// Payment Rating Codes (Field 17B)
export const PAYMENT_RATING_CODES: Record<string, { code: string; description: string; daysLate: number }> = {
  '0': { code: '0', description: 'Current', daysLate: 0 },
  '1': { code: '1', description: '30-59 days late', daysLate: 30 },
  '2': { code: '2', description: '60-89 days late', daysLate: 60 },
  '3': { code: '3', description: '90-119 days late', daysLate: 90 },
  '4': { code: '4', description: '120-149 days late', daysLate: 120 },
  '5': { code: '5', description: '150-179 days late', daysLate: 150 },
  '6': { code: '6', description: '180+ days late', daysLate: 180 },
  'G': { code: 'G', description: 'Collection', daysLate: 180 },
  'L': { code: 'L', description: 'Charge-off', daysLate: 180 },
};

// Account Type Codes (Field 6)
export const ACCOUNT_TYPE_CODES: Record<string, { code: string; description: string; category: string }> = {
  '00': { code: '00', description: 'Unknown', category: 'other' },
  '01': { code: '01', description: 'Unsecured', category: 'personal_loan' },
  '02': { code: '02', description: 'Secured', category: 'personal_loan' },
  '03': { code: '03', description: 'Credit card', category: 'credit_card' },
  '04': { code: '04', description: 'Installment sales contract', category: 'personal_loan' },
  '05': { code: '05', description: 'Revolving charge', category: 'credit_card' },
  '06': { code: '06', description: 'Auto loan', category: 'auto_loan' },
  '07': { code: '07', description: 'Real estate mortgage', category: 'mortgage' },
  '08': { code: '08', description: 'Home equity', category: 'mortgage' },
  '10': { code: '10', description: 'Retail', category: 'credit_card' },
  '11': { code: '11', description: 'Check credit', category: 'credit_card' },
  '12': { code: '12', description: 'Home improvement', category: 'personal_loan' },
  '13': { code: '13', description: 'Manufactured housing', category: 'mortgage' },
  '15': { code: '15', description: 'Medical debt', category: 'medical' },
  '17': { code: '17', description: 'Lease', category: 'auto_loan' },
  '18': { code: '18', description: 'Credit line secured', category: 'credit_card' },
  '19': { code: '19', description: 'Debit card', category: 'other' },
  '20': { code: '20', description: 'Educational', category: 'student_loan' },
  '25': { code: '25', description: 'Collection', category: 'collection' },
  '26': { code: '26', description: 'Utility company', category: 'other' },
  '29': { code: '29', description: 'Business credit card', category: 'credit_card' },
  '47': { code: '47', description: 'Government', category: 'other' },
  '48': { code: '48', description: 'Government student loan', category: 'student_loan' },
  '89': { code: '89', description: 'Rental agreement', category: 'other' },
  '90': { code: '90', description: 'Medical debt - VA', category: 'medical' },
  '91': { code: '91', description: 'Debt buyer', category: 'collection' },
  '9A': { code: '9A', description: 'Collection agency/attorney', category: 'collection' },
  '9B': { code: '9B', description: 'Purchased', category: 'collection' },
};

// Special Comment Codes (Field 19)
export const SPECIAL_COMMENT_CODES: Record<string, string> = {
  'AC': 'Account closed at consumer request',
  'AD': 'Account closed at credit grantor request',
  'AH': 'Account previously in dispute - now resolved',
  'AI': 'Account information disputed by consumer',
  'AM': 'Account acquired by another company',
  'AN': 'Account closed - may reopen',
  'AO': 'Account closed - will not reopen',
  'AU': 'Account transferred',
  'AW': 'Account written off',
  'B': 'Account payments managed by financial counseling',
  'BL': 'Credit line suspended',
  'C': 'Consumer deceased',
  'CL': 'Credit limit',
  'CO': 'Closed',
  'D': 'Dispute resolved - consumer disagrees',
  'DA': 'Dispute resolved - reported by grantor',
  'M': 'Account merged',
  'O': 'Account in dispute - investigation in progress',
  'PD': 'Paid by dealer',
  'PL': 'Placed for collection',
  'R': 'Refinanced',
  'S': 'Special handling',
  'V': 'Voluntary surrender',
  'XA': 'Account closed at consumer request',
  'XB': 'Account closed at credit grantor request',
};

// Compliance Indicator Codes
export const COMPLIANCE_CODES: Record<string, string> = {
  'XA': 'Account closed at consumer request',
  'XB': 'Account closed at credit grantor request',
  'XC': 'Account closed - paid in full, was a collection account',
  'XD': 'Account closed - paid in full, was a charge-off',
  'XF': 'Account information disputed under FCRA',
  'XH': 'Account previously in dispute - now resolved',
  'XR': 'Meets requirements for reporting',
};

// FCRA Reporting Periods (in years)
export const FCRA_REPORTING_LIMITS = {
  general: 7, // Most negative items
  bankruptcy_chapter7: 10,
  bankruptcy_chapter13: 7,
  tax_liens_paid: 7,
  tax_liens_unpaid: 0, // Removed from credit reports as of 2018
  civil_judgments: 0, // Removed from credit reports as of 2017
  collections: 7,
  charge_offs: 7,
  late_payments: 7,
  foreclosures: 7,
  repossessions: 7,
  inquiries_hard: 2,
  inquiries_soft: 0, // Not visible to third parties
};

// Standard internal schema for parsed credit data
export interface StandardizedAccount {
  // Identification
  creditorName: string;
  accountNumber?: string; // Masked
  originalCreditor?: string;
  
  // Account Classification
  accountType: string;
  accountTypeCode?: string;
  accountCategory: 'credit_card' | 'auto_loan' | 'mortgage' | 'personal_loan' | 'student_loan' | 'collection' | 'medical' | 'other';
  
  // Status
  accountStatus: 'open' | 'closed' | 'collection' | 'charge_off' | 'paid' | 'transferred';
  accountStatusCode?: string;
  paymentStatus: 'current' | '30_days_late' | '60_days_late' | '90_days_late' | '120_days_late' | '150_days_late' | '180_days_late' | 'collection' | 'charge_off';
  paymentRatingCode?: string;
  
  // Financial Data
  balance?: number;
  creditLimit?: number;
  highCredit?: number;
  monthlyPayment?: number;
  pastDueAmount?: number;
  originalAmount?: number;
  
  // Dates
  dateOpened?: Date;
  dateReported?: Date;
  dateLastActivity?: Date;
  dateLastPayment?: Date;
  dateClosed?: Date;
  dateFirstDelinquency?: Date;
  
  // Bureau Information
  bureau: 'transunion' | 'experian' | 'equifax';
  
  // Analysis Fields
  isNegative: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'severe';
  fcraComplianceDate?: Date; // When item should fall off per FCRA
  
  // Payment History (24-month grid)
  paymentHistory?: string[]; // Array of payment codes by month
  
  // Remarks and Comments
  remarks?: string;
  specialComment?: string;
  specialCommentCode?: string;
  
  // Dispute Information
  inDispute?: boolean;
  disputeDate?: Date;
  
  // Completeness tracking
  missingFields: string[];
  completenessScore: number; // 0-100
}

export interface StandardizedConsumerProfile {
  // Names
  names: Array<{
    firstName: string;
    middleName?: string;
    lastName: string;
    suffix?: string;
    bureau: 'transunion' | 'experian' | 'equifax';
  }>;
  
  // Addresses
  addresses: Array<{
    street: string;
    city: string;
    state: string;
    zipCode: string;
    addressType?: 'current' | 'previous' | 'other';
    dateReported?: Date;
    bureau: 'transunion' | 'experian' | 'equifax';
  }>;
  
  // Identifiers
  ssnLast4?: string;
  dateOfBirth?: Date;
  
  // Employment
  employers: Array<{
    name: string;
    dateReported?: Date;
    bureau: 'transunion' | 'experian' | 'equifax';
  }>;
}

export interface StandardizedInquiry {
  creditorName: string;
  inquiryDate?: Date;
  inquiryType: 'hard' | 'soft' | 'promotional' | 'account_review';
  bureau: 'transunion' | 'experian' | 'equifax';
  permissiblePurpose?: string;
}

export interface StandardizedPublicRecord {
  recordType: 'bankruptcy' | 'tax_lien' | 'civil_judgment' | 'foreclosure' | 'other';
  court?: string;
  caseNumber?: string;
  filingDate?: Date;
  resolvedDate?: Date;
  amount?: number;
  status: 'filed' | 'discharged' | 'dismissed' | 'satisfied' | 'released' | 'other';
  bureau: 'transunion' | 'experian' | 'equifax';
  fcraComplianceDate?: Date;
}

// Helper functions for mapping
export function mapPaymentStatusToCode(status: string): string | undefined {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('current') || statusLower.includes('ok') || statusLower.includes('paid as agreed')) {
    return '0';
  }
  if (statusLower.includes('30') && statusLower.includes('late')) return '1';
  if (statusLower.includes('60') && statusLower.includes('late')) return '2';
  if (statusLower.includes('90') && statusLower.includes('late')) return '3';
  if (statusLower.includes('120') && statusLower.includes('late')) return '4';
  if (statusLower.includes('150') && statusLower.includes('late')) return '5';
  if (statusLower.includes('180') && statusLower.includes('late')) return '6';
  if (statusLower.includes('collection')) return 'G';
  if (statusLower.includes('charge') && statusLower.includes('off')) return 'L';
  return undefined;
}

export function mapAccountTypeToCategory(type: string): StandardizedAccount['accountCategory'] {
  const typeLower = type.toLowerCase();
  if (typeLower.includes('credit card') || typeLower.includes('revolving') || typeLower.includes('visa') || typeLower.includes('mastercard') || typeLower.includes('amex') || typeLower.includes('discover')) {
    return 'credit_card';
  }
  if (typeLower.includes('auto') || typeLower.includes('vehicle') || typeLower.includes('car')) {
    return 'auto_loan';
  }
  if (typeLower.includes('mortgage') || typeLower.includes('home loan') || typeLower.includes('real estate') || typeLower.includes('home equity')) {
    return 'mortgage';
  }
  if (typeLower.includes('student') || typeLower.includes('education')) {
    return 'student_loan';
  }
  if (typeLower.includes('collection') || typeLower.includes('debt buyer')) {
    return 'collection';
  }
  if (typeLower.includes('medical') || typeLower.includes('hospital') || typeLower.includes('healthcare')) {
    return 'medical';
  }
  if (typeLower.includes('personal') || typeLower.includes('installment') || typeLower.includes('unsecured')) {
    return 'personal_loan';
  }
  return 'other';
}

export function calculateFcraComplianceDate(item: { itemType: string; dateFirstDelinquency?: Date; filingDate?: Date }): Date | undefined {
  const baseDate = item.dateFirstDelinquency || item.filingDate;
  if (!baseDate) return undefined;

  let yearsToAdd = FCRA_REPORTING_LIMITS.general;
  
  const itemTypeLower = item.itemType?.toLowerCase() || '';
  if (itemTypeLower.includes('bankruptcy') && itemTypeLower.includes('chapter 7')) {
    yearsToAdd = FCRA_REPORTING_LIMITS.bankruptcy_chapter7;
  } else if (itemTypeLower.includes('bankruptcy') && itemTypeLower.includes('chapter 13')) {
    yearsToAdd = FCRA_REPORTING_LIMITS.bankruptcy_chapter13;
  }

  const complianceDate = new Date(baseDate);
  complianceDate.setFullYear(complianceDate.getFullYear() + yearsToAdd);
  return complianceDate;
}

export function calculateCompletenessScore(account: Partial<StandardizedAccount>): { score: number; missingFields: string[] } {
  const requiredFields = [
    { field: 'creditorName', weight: 15 },
    { field: 'accountNumber', weight: 10 },
    { field: 'accountType', weight: 10 },
    { field: 'accountStatus', weight: 15 },
    { field: 'balance', weight: 10 },
    { field: 'dateOpened', weight: 10 },
    { field: 'dateReported', weight: 10 },
    { field: 'paymentStatus', weight: 10 },
    { field: 'creditLimit', weight: 5 },
    { field: 'highCredit', weight: 5 },
  ];

  let totalWeight = 0;
  let earnedWeight = 0;
  const missingFields: string[] = [];

  for (const { field, weight } of requiredFields) {
    totalWeight += weight;
    const value = account[field as keyof typeof account];
    if (value !== undefined && value !== null && value !== '') {
      earnedWeight += weight;
    } else {
      missingFields.push(field);
    }
  }

  return {
    score: Math.round((earnedWeight / totalWeight) * 100),
    missingFields,
  };
}

export function isAccountNegative(account: Partial<StandardizedAccount>): boolean {
  // Check account status
  if (account.accountStatus === 'collection' || account.accountStatus === 'charge_off') {
    return true;
  }

  // Check payment status
  if (account.paymentStatus && account.paymentStatus !== 'current') {
    return true;
  }

  // Check if past due amount exists
  if (account.pastDueAmount && account.pastDueAmount > 0) {
    return true;
  }

  // Check Metro 2 status code
  if (account.accountStatusCode) {
    const statusInfo = ACCOUNT_STATUS_CODES[account.accountStatusCode];
    if (statusInfo?.isNegative) {
      return true;
    }
  }

  return false;
}

export function calculateRiskLevel(account: Partial<StandardizedAccount>): 'low' | 'medium' | 'high' | 'severe' {
  if (!isAccountNegative(account)) {
    return 'low';
  }

  // Severe: Collections, charge-offs, public records
  if (account.accountStatus === 'collection' || account.accountStatus === 'charge_off') {
    return 'severe';
  }
  if (account.accountCategory === 'collection') {
    return 'severe';
  }

  // High: 90+ days late
  if (account.paymentStatus === '90_days_late' || account.paymentStatus === '120_days_late' || 
      account.paymentStatus === '150_days_late' || account.paymentStatus === '180_days_late') {
    return 'high';
  }

  // Medium: 30-60 days late
  if (account.paymentStatus === '30_days_late' || account.paymentStatus === '60_days_late') {
    return 'medium';
  }

  return 'medium';
}

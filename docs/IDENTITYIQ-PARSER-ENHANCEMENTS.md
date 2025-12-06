# IdentityIQ Parser Enhancements

**Date:** December 6, 2025  
**File:** `src/lib/parsers/identityiq-parser.ts`  
**Related Files:** `src/lib/parsers/pdf-parser.ts`, `src/lib/credit-analysis-report.ts`

---

## Overview

This document details the comprehensive enhancements made to the IdentityIQ HTML credit report parser. These improvements address critical gaps in detecting negative items, personal information discrepancies, and FCRA compliance violations.

---

## Table of Contents

1. [Two-Year Payment History Parsing](#1-two-year-payment-history-parsing)
2. [Enhanced Derogatory Detection](#2-enhanced-derogatory-detection)
3. [Improved Negative Items Classification](#3-improved-negative-items-classification)
4. [Personal Information Dispute Items](#4-personal-information-dispute-items)
5. [Inquiry Dispute Items with FCRA Compliance](#5-inquiry-dispute-items-with-fcra-compliance)
6. [New Type Definitions](#6-new-type-definitions)
7. [Comprehensive Report Integration](#7-comprehensive-report-integration)

---

## 1. Two-Year Payment History Parsing

### Problem
The parser was only extracting data from the 4-column summary table (Account Status, Payment Status fields). This missed **true delinquent accounts** where:
- The `Payment Status` shows "Current" or "Pays as Agreed"
- But the **two-year payment history grid** contains 30/60/90/120+ late payments

### Solution
Added parsing of the `table.rpt_content_table.addr_hsrty` element which contains the two-year payment history grid.

### New Selectors
```typescript
const IIQ_SELECTORS = {
  // ... existing selectors
  paymentHistoryTable: 'table.rpt_content_table.addr_hsrty',
  paymentHistoryHeader: 'div.hstry-header.hstry-header-2yr',
};
```

### CSS Class Patterns for Late Detection
```typescript
const PAYMENT_HISTORY_CLASSES = {
  late30: 'hstry-30',
  late60: 'hstry-60',
  late90: 'hstry-90',
  late120: 'hstry-120',
  late150: 'hstry-150',
  late180: 'hstry-180',
  chargeOff: 'hstry-other',
  collection: 'hstry-co',
  ok: 'hstry-ok',
};
```

### New Function: `extractPaymentHistory()`
```typescript
function extractPaymentHistory(
  $: cheerio.CheerioAPI,
  $accountTable: cheerio.Cheerio<AnyNode>
): Record<'transunion' | 'experian' | 'equifax', PaymentHistorySummary>
```

**How it works:**
1. Finds the `.addr_hsrty` table within or after each account table
2. Parses rows by bureau (Row 1 = TransUnion, Row 2 = Experian, Row 3 = Equifax)
3. Counts cells with late status classes (`hstry-30`, `hstry-60`, etc.)
4. Computes `maxLateDays` for each bureau (0, 30, 60, 90, 120, 150, or 180)

### Helper Functions
```typescript
function createEmptyPaymentHistory(): PaymentHistorySummary {
  return {
    lateCount30: 0,
    lateCount60: 0,
    lateCount90: 0,
    lateCount120: 0,
    lateCount150: 0,
    lateCount180: 0,
    chargeOffCount: 0,
    collectionCount: 0,
    maxLateDays: 0,
  };
}

function computeMaxLateDays(history: PaymentHistorySummary): number {
  if (history.lateCount180 > 0 || history.chargeOffCount > 0) return 180;
  if (history.lateCount150 > 0) return 150;
  if (history.lateCount120 > 0) return 120;
  if (history.lateCount90 > 0) return 90;
  if (history.lateCount60 > 0) return 60;
  if (history.lateCount30 > 0) return 30;
  return 0;
}
```

---

## 2. Enhanced Derogatory Detection

### Problem
`checkIfDerogatory()` only checked `accountStatus` and `paymentStatus` text fields. Accounts with clean status text but late history in the payment grid were missed.

### Solution
Updated `checkIfDerogatory()` to accept optional payment history and check `maxLateDays`.

### Updated Function Signature
```typescript
function checkIfDerogatory(
  accountData: Record<string, Record<string, string>>,
  paymentHistory?: Record<'transunion' | 'experian' | 'equifax', PaymentHistorySummary>
): boolean
```

### New Detection Logic
```typescript
for (const bureau of ['transunion', 'experian', 'equifax'] as const) {
  const data = accountData[bureau];
  const status = (data.accountStatus || '').toLowerCase();
  const paymentStatus = (data.paymentStatus || '').toLowerCase();
  const maxLate = paymentHistory?.[bureau]?.maxLateDays ?? 0;
  
  // Check account status
  if (status === 'derogatory') return true;
  
  // Check payment status patterns
  for (const pattern of DEROGATORY_PATTERNS) {
    if (paymentStatus.includes(pattern)) return true;
  }
  
  // NEW: Check two-year payment history for lates
  if (maxLate >= 30) return true;
}
```

### Integration Point
In `extractIIQAccounts()`:
```typescript
// Extract two-year payment history for this account
const paymentHistory = extractPaymentHistory($, $accountTable);

// Check if this is a derogatory account (now includes payment history)
const isDerogatoryAccount = checkIfDerogatory(accountData, paymentHistory);
```

---

## 3. Improved Negative Items Classification

### Problem
1. Deduplication was too aggressive - used only `creditorName.toLowerCase()`, collapsing multiple bad accounts from the same creditor
2. Classification didn't distinguish "Delinquent" (lates) from "Derogatory" (generic)
3. Payment history wasn't factored into item type determination

### Solution
Complete rewrite of `buildNegativeItems()` with:

### Improved Deduplication
```typescript
// OLD: const addedCreditors = new Set<string>();
// NEW: 
const addedKeys = new Set<string>();

// Dedupe key includes creditor + bureau + item type/account number
const dedupKey = `${creditorName.toLowerCase()}|${bureau}|${itemType}`;
```

### Better Item Type Classification
```typescript
// Priority: collection > charge_off > late_payment > derogatory
let itemType = 'derogatory';

if (status.includes('collection')) {
  itemType = 'collection';
} else if (status.includes('chargeoff') || status.includes('charge off')) {
  itemType = 'charge_off';
} else if (status.includes('late') || maxLate >= 30) {
  itemType = 'late_payment'; // "Delinquent" bucket
}
```

### Risk Severity Based on Late History
```typescript
let riskSeverity: string;
if (itemType === 'collection' || itemType === 'charge_off' || maxLate >= 90) {
  riskSeverity = 'high';
} else if (maxLate >= 60) {
  riskSeverity = 'medium';
} else {
  riskSeverity = 'medium';
}
```

### Per-Bureau Processing
Instead of creating one negative item per creditor, we now process each bureau separately:
```typescript
for (const bureau of ['transunion', 'experian', 'equifax'] as const) {
  const bureauData = derog[bureau];
  if (!bureauData.accountStatus && !bureauData.paymentStatus) continue;
  // ... create item per bureau
}
```

---

## 4. Personal Information Dispute Items

### Purpose
Enable AI-driven dispute letters for inaccurate/obsolete personal data (names, addresses, DOB, employers, AKAs).

### New Type Definition
```typescript
// In pdf-parser.ts
export type PersonalInfoDisputeType =
  | 'name'
  | 'also_known_as'
  | 'former_name'
  | 'date_of_birth'
  | 'current_address'
  | 'previous_address'
  | 'employer';

export interface PersonalInfoDisputeItem {
  type: PersonalInfoDisputeType;
  bureau: 'transunion' | 'experian' | 'equifax';
  value: string;
}
```

### New Function: `buildPersonalInfoDisputes()`
```typescript
function buildPersonalInfoDisputes(
  personalInfo: BureauPersonalInfo
): PersonalInfoDisputeItem[]
```

**How it works:**
1. Iterates over each bureau's personal info
2. Creates disputable items for:
   - Name
   - Date of Birth
   - Current Address
   - Previous Addresses (multiple)
   - Also Known As / AKAs (multiple)
   - Former Names (multiple)
   - Employers (multiple)
3. Filters out empty values and placeholders (`-`)

### Output Example
```json
[
  { "type": "name", "bureau": "transunion", "value": "CHRISTAL C PIQUE" },
  { "type": "current_address", "bureau": "experian", "value": "5921 MANCHESTER WAY TAMARAC, FL 33321-4191" },
  { "type": "employer", "bureau": "transunion", "value": "MERCEDES BENS" }
]
```

---

## 5. Inquiry Dispute Items with FCRA Compliance

### Purpose
1. Convert inquiries into disputable items
2. Flag inquiries that exceed the **2-year FCRA reporting limit**
3. Enable targeted dispute letters citing FCRA Section 605

### New Type Definition
```typescript
// In pdf-parser.ts
export interface InquiryDisputeItem {
  type: 'inquiry';
  creditorName: string;
  bureau?: 'transunion' | 'experian' | 'equifax';
  inquiryDate?: Date;
  inquiryType?: string;
  isPastFcraLimit: boolean;  // KEY: Flags FCRA violations
  daysSinceInquiry?: number;
}
```

### FCRA Limit Constant
```typescript
// FCRA allows inquiries to be reported for 2 years
const INQUIRY_FCRA_LIMIT_MS = 1000 * 60 * 60 * 24 * 365 * 2; // 2 years in milliseconds
```

### New Function: `buildInquiryDisputes()`
```typescript
function buildInquiryDisputes(inquiries: ParsedInquiry[]): InquiryDisputeItem[]
```

**How it works:**
1. Calculates `daysSinceInquiry` for each inquiry
2. Sets `isPastFcraLimit = true` if inquiry is older than 2 years
3. Normalizes bureau names (tu/tuc → transunion, exp → experian, eq/eqf → equifax)

### Output Example
```json
{
  "type": "inquiry",
  "creditorName": "CAPITAL ONE BANK",
  "bureau": "experian",
  "inquiryDate": "2022-11-08T00:00:00.000Z",
  "inquiryType": "CREDIT CARD",
  "isPastFcraLimit": true,
  "daysSinceInquiry": 759
}
```

---

## 6. New Type Definitions

### Added to `pdf-parser.ts`

```typescript
// Two-year payment history summary per bureau
export interface PaymentHistorySummary {
  lateCount30: number;
  lateCount60: number;
  lateCount90: number;
  lateCount120: number;
  lateCount150: number;
  lateCount180: number;
  chargeOffCount: number;
  collectionCount: number;
  maxLateDays: number; // 0, 30, 60, 90, 120, 150, 180
}

// Extended DerogatoryAccount to include payment history per bureau
export interface DerogatoryAccount {
  // ... existing fields
  transunion: {
    // ... existing fields
    paymentHistory?: PaymentHistorySummary;
  };
  experian: {
    // ... existing fields
    paymentHistory?: PaymentHistorySummary;
  };
  equifax: {
    // ... existing fields
    paymentHistory?: PaymentHistorySummary;
  };
}

// Personal information dispute types
export type PersonalInfoDisputeType = 
  | 'name' | 'also_known_as' | 'former_name' | 'date_of_birth' 
  | 'current_address' | 'previous_address' | 'employer';

export interface PersonalInfoDisputeItem {
  type: PersonalInfoDisputeType;
  bureau: 'transunion' | 'experian' | 'equifax';
  value: string;
}

// Inquiry dispute item
export interface InquiryDisputeItem {
  type: 'inquiry';
  creditorName: string;
  bureau?: 'transunion' | 'experian' | 'equifax';
  inquiryDate?: Date;
  inquiryType?: string;
  isPastFcraLimit: boolean;
  daysSinceInquiry?: number;
}

// Extended parsed data interface
export interface ExtendedParsedCreditData extends ParsedCreditData {
  // ... existing fields
  personalInfoDisputes?: PersonalInfoDisputeItem[];
  inquiryDisputes?: InquiryDisputeItem[];
}
```

---

## 7. Comprehensive Report Integration

### Updated `parseIdentityIQReport()` Return Object
```typescript
export function parseIdentityIQReport(html: string): ExtendedParsedCreditData {
  // ... extraction code
  
  const negativeItems = buildNegativeItems(derogatoryAccounts, accounts);
  const personalInfoDisputes = buildPersonalInfoDisputes(bureauPersonalInfo);
  const inquiryDisputes = buildInquiryDisputes(inquiries);

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
    personalInfoDisputes,  // NEW
    inquiryDisputes,       // NEW
  } as ExtendedParsedCreditData;
}
```

### Comprehensive Report Enhancements (`credit-analysis-report.ts`)

#### Personal Information Section
- Displays all personal info per bureau in a table
- Highlights discrepancies with yellow background and warning icons
- Shows warning box when name/DOB/address differs across bureaus
- Educational tip about Metro 2 compliance implications

#### Inquiries Section
- Added **"Status"** column showing "FCRA VIOLATION" or "Within Limit"
- Red warning box when FCRA violations detected
- Lists violating inquiries with exact age (years + days)
- Provides specific FCRA citation (Section 605, 15 U.S.C. § 1681c)
- Highlights violating rows in red

---

## Summary of Changes

| Feature | Before | After |
|---------|--------|-------|
| Payment History Parsing | Not parsed | Parses 2-year grid, counts 30/60/90/120/150/180 lates |
| Derogatory Detection | Status/Payment text only | Includes `maxLateDays >= 30` |
| Negative Item Deduplication | Creditor name only | Creditor + Bureau + Account/Type |
| Item Classification | Limited categories | Collection, Charge-off, Delinquent, Derogatory |
| Personal Info Disputes | Not available | Full dispute items per bureau |
| Inquiry FCRA Compliance | Not checked | Flags inquiries > 2 years |
| Report Personal Info | Not displayed | Full table with discrepancy highlights |
| Report Inquiries | Basic table | FCRA violation flags and warnings |

---

## Usage in AI Dispute System

The parser now provides three major dispute buckets for AI letter generation:

1. **`negativeItems`** → Derogatory/Collections/Charge-offs/Lates (tradelines)
2. **`personalInfoDisputes`** → Names, AKAs, addresses, DOB, employers
3. **`inquiryDisputes`** → Inquiries with FCRA compliance status

AI prompts can now reference specific FCRA citations:
- **Section 605 (15 U.S.C. § 1681c)** - Obsolete information (inquiries > 2 years)
- **Section 611 (15 U.S.C. § 1681i)** - Reinvestigation requirements
- **Section 623 (15 U.S.C. § 1681s-2)** - Furnisher duty to provide accurate information

---

## Testing Recommendations

1. Parse `C_Pique_creditReport.html` and verify:
   - Accounts with 30/60/90+ lates in the payment grid are flagged as negative
   - Personal info discrepancies are detected across bureaus
   - Inquiries older than 2 years have `isPastFcraLimit: true`

2. Verify deduplication doesn't collapse:
   - Multiple accounts from same creditor with different statuses
   - Same creditor reported to different bureaus

3. Check comprehensive report displays:
   - Personal Information section with discrepancy warnings
   - Inquiries section with FCRA violation flags

# IdentityIQ Credit Report Parser - Technical Guide

This document explains how the IdentityIQ HTML credit report parser works, including the DOM structure, extraction logic, and how to adapt this approach for other credit monitoring services.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [IdentityIQ HTML Structure](#identityiq-html-structure)
4. [DOM Selectors](#dom-selectors)
5. [Data Extraction Flow](#data-extraction-flow)
6. [TypeScript Interfaces](#typescript-interfaces)
7. [Derogatory Detection Logic](#derogatory-detection-logic)
8. [Credit Utilization Calculation](#credit-utilization-calculation)
9. [Adapting for Other Services](#adapting-for-other-services)

---

## Overview

The IdentityIQ parser extracts structured credit data from HTML credit reports exported from IdentityIQ credit monitoring service. It produces:

- **Credit Scores** - Per bureau (TransUnion, Experian, Equifax)
- **Bureau Summary** - Account counts, delinquent/derogatory counts, balances per bureau
- **Derogatory Accounts** - Negative items with per-bureau status and dates
- **Credit Utilization** - Revolving credit usage per bureau
- **Inquiries** - Credit inquiries with dates and bureau
- **Public Records** - Bankruptcies, liens, judgments
- **Consumer Profile** - Names, addresses, DOB

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    parseIdentityIQReport()                   │
│                         Main Entry                           │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ extractIIQScores│ │extractBureauSum │ │extractIIQAccounts│
│                 │ │     mary        │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ extractConsumer │ │calculateCredit  │ │ extractPublic   │
│    Profile      │ │  Utilization    │ │    Records      │
└─────────────────┘ └─────────────────┘ └─────────────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
                 ┌─────────────────────┐
                 │ExtendedParsedCredit │
                 │        Data         │
                 └─────────────────────┘
```

**Key Files:**
- `src/lib/parsers/identityiq-parser.ts` - Main parser implementation
- `src/lib/parsers/pdf-parser.ts` - Shared interfaces
- `src/lib/parsers/metro2-mapping.ts` - Risk assessment utilities

---

## IdentityIQ HTML Structure

IdentityIQ uses an AngularJS-based HTML structure with specific patterns:

### Document Layout

```html
<div ng-controller="CreditReportController">
  <transunion-report>
    <!-- Personal Information Section -->
    <div class="rpt_content_wrapper">
      <div class="rpt_fullReport_header">Personal Information</div>
      <table class="rpt_content_table rpt_table4column">
        <!-- 4-column layout: Label | TU | EXP | EQ -->
      </table>
    </div>
    
    <!-- Credit Score Section -->
    <div class="rpt_content_wrapper" id="CreditScore">
      ...
    </div>
    
    <!-- Summary Section -->
    <div class="rpt_content_wrapper" id="Summary">
      ...
    </div>
    
    <!-- Account History -->
    <address-history>
      <table class="crPrint ng-scope">
        <!-- Individual account tables -->
      </table>
    </address-history>
    
    <!-- Inquiries -->
    <div id="Inquiries">...</div>
    
    <!-- Public Records -->
    <div id="PublicInformation">...</div>
  </transunion-report>
</div>
```

### 4-Column Table Structure

Most data tables follow this pattern:

```html
<table class="rpt_content_table rpt_content_header rpt_table4column">
  <tr>
    <th></th>
    <th class="headerTUC">TransUnion</th>
    <th class="headerEXP">Experian</th>
    <th class="headerEQF">Equifax</th>
  </tr>
  <tr>
    <td class="label">Credit Score:</td>
    <td class="info">509</td>
    <td class="info">509</td>
    <td class="info">506</td>
  </tr>
</table>
```

---

## DOM Selectors

The parser uses these specific selectors:

```typescript
const IIQ_SELECTORS = {
  // Main sections (by ID)
  creditScoreSection: '#CreditScore',
  summarySection: '#Summary',
  inquiriesSection: '#Inquiries',
  publicRecordsSection: '#PublicInformation',
  
  // Custom elements
  accountHistorySection: 'address-history',
  
  // Table classes
  fourColumnTable: 'table.rpt_content_table.rpt_table4column',
  accountTable: 'table.crPrint.ng-scope',
  
  // Bureau header classes (for column identification)
  headerTransunion: '.headerTUC',
  headerExperian: '.headerEXP',
  headerEquifax: '.headerEQF',
  
  // Cell classes
  labelCell: 'td.label',
  infoCell: 'td.info',
  
  // Content wrappers
  contentWrapper: '.rpt_content_wrapper',
  fullReportHeader: '.rpt_fullReport_header',
};
```

### Bureau Column Mapping

In 4-column tables:
- **Column 0**: Label (e.g., "Credit Score:")
- **Column 1**: TransUnion value
- **Column 2**: Experian value
- **Column 3**: Equifax value

---

## Data Extraction Flow

### 1. Credit Scores

```typescript
function extractIIQScores($: cheerio.CheerioAPI): Scores {
  // 1. Find #CreditScore section
  // 2. Locate the 4-column table
  // 3. Find row where label includes "credit score"
  // 4. Extract values from columns 1, 2, 3
  // 5. Validate scores are 300-850 range
}
```

**Row identification:** Look for `td.label` containing "credit score"

### 2. Bureau Summary

```typescript
function extractBureauSummary($: cheerio.CheerioAPI): BureauSummary {
  // Field mappings for label text -> property name
  const fieldMappings = {
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
  
  // For each row, match label and extract 3 bureau values
}
```

### 3. Account/Tradeline Extraction

Accounts are within `<address-history>` elements:

```typescript
function extractIIQAccounts($: cheerio.CheerioAPI) {
  // 1. Find all address-history elements
  // 2. Within each, find table.crPrint.ng-scope
  // 3. Get creditor name from div.sub_header
  // 4. Find nested data table (rpt_content_table.rpt_table4column)
  // 5. Extract fields by label:
  //    - "account #" -> accountNumber
  //    - "account type" -> accountType
  //    - "account status" -> accountStatus
  //    - "balance:" -> balance
  //    - "credit limit" -> creditLimit
  //    - "date opened" -> dateOpened
  //    - "payment status" -> paymentStatus
  // 6. Check if derogatory, add to derogatoryAccounts list
}
```

### 4. Inquiries

```typescript
function extractIIQInquiries($: cheerio.CheerioAPI): ParsedInquiry[] {
  // 1. Find #Inquiries section
  // 2. Locate contacts table
  // 3. Extract: Business Name, Business Type, Date, Bureau
}
```

---

## TypeScript Interfaces

### Core Data Types

```typescript
// Per-bureau metrics
interface BureauMetrics {
  creditScore?: number;
  lenderRank?: string;
  scoreScale?: string;
  reportDate?: string;
  totalAccounts: number;
  openAccounts: number;
  closedAccounts: number;
  delinquent: number;
  derogatory: number;
  collection: number;
  balances: number;      // In cents
  payments: number;      // In cents
  publicRecords: number;
  inquiries: number;
}

// All 3 bureaus
interface BureauSummary {
  transunion: BureauMetrics;
  experian: BureauMetrics;
  equifax: BureauMetrics;
}

// Credit utilization
interface CreditUtilization {
  balance: number;   // In cents
  limit: number;     // In cents
  percent: number;   // 0-100
  rating: 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor' | 'no_data';
}

// Derogatory account with per-bureau details
interface DerogatoryAccount {
  creditorName: string;
  uniqueStatus: string;  // Combined status across bureaus
  transunion: {
    accountStatus?: string;
    accountDate?: string;
    paymentStatus?: string;
  };
  experian: { /* same */ };
  equifax: { /* same */ };
}
```

### Extended Return Type

```typescript
interface ExtendedParsedCreditData extends ParsedCreditData {
  bureauSummary?: BureauSummary;
  creditUtilization?: BureauCreditUtilization;
  derogatoryAccounts?: DerogatoryAccount[];
  publicRecords?: PublicRecord[];
}
```

---

## Derogatory Detection Logic

An account is flagged as derogatory if ANY of these conditions are true:

```typescript
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

function checkIfDerogatory(accountData): boolean {
  for (const bureau of ['transunion', 'experian', 'equifax']) {
    const status = accountData[bureau].accountStatus?.toLowerCase();
    const paymentStatus = accountData[bureau].paymentStatus?.toLowerCase();
    
    // Check account status
    if (status === 'derogatory') return true;
    
    // Check payment status for late patterns
    for (const pattern of DEROGATORY_PATTERNS) {
      if (paymentStatus?.includes(pattern)) return true;
    }
  }
  return false;
}
```

### Unique Status Generation

Combines distinct statuses across bureaus:

```typescript
function buildUniqueStatus(accountData): string {
  const statuses = new Set<string>();
  
  for (const bureau of ['transunion', 'experian', 'equifax']) {
    const paymentStatus = accountData[bureau].paymentStatus;
    if (paymentStatus && paymentStatus !== '-') {
      statuses.add(paymentStatus);
    }
  }
  
  return Array.from(statuses).join(', ');
  // Example: "Collection/Chargeoff, Late 120 Days"
}
```

---

## Credit Utilization Calculation

Credit utilization is calculated **only for revolving accounts that are open**:

```typescript
function calculateCreditUtilization($): BureauCreditUtilization {
  const utilization = {
    transunion: { balance: 0, limit: 0, percent: 0, rating: 'no_data' },
    experian: { balance: 0, limit: 0, percent: 0, rating: 'no_data' },
    equifax: { balance: 0, limit: 0, percent: 0, rating: 'no_data' },
    total: { balance: 0, limit: 0, percent: 0, rating: 'no_data' },
  };

  // For each account
  for (const bureau of ['transunion', 'experian', 'equifax']) {
    const accountType = data[bureau].accountType?.toLowerCase();
    const accountStatus = data[bureau].accountStatus?.toLowerCase();
    
    // Only count revolving + open accounts
    if (accountType === 'revolving' && accountStatus === 'open') {
      utilization[bureau].balance += parseBalance(data[bureau].balance);
      utilization[bureau].limit += parseLimit(data[bureau].creditLimit);
    }
  }

  // Calculate percentages
  for (const bureau of ['transunion', 'experian', 'equifax']) {
    if (utilization[bureau].limit > 0) {
      utilization[bureau].percent = Math.round(
        (utilization[bureau].balance / utilization[bureau].limit) * 100
      );
      utilization[bureau].rating = getUtilizationRating(utilization[bureau].percent);
    }
  }

  return utilization;
}

// Rating thresholds (matching PHP system)
function getUtilizationRating(percent: number): string {
  if (percent >= 75) return 'very_poor';
  if (percent >= 50) return 'poor';
  if (percent >= 30) return 'fair';
  if (percent >= 10) return 'good';
  if (percent >= 0) return 'excellent';
  return 'no_data';
}
```

---

## Adapting for Other Services

To create a parser for a different credit monitoring service:

### Step 1: Obtain Sample HTML

Get a real HTML export from the service. Save it in the project root for testing.

### Step 2: Analyze HTML Structure

Open the HTML and identify:

1. **Section markers** - IDs or classes that identify main sections
2. **Table structure** - How bureaus are organized (columns? separate tables?)
3. **Data labels** - How fields are labeled (e.g., "Balance:", "Current Balance:", etc.)
4. **Bureau identification** - How to know which data belongs to which bureau

### Step 3: Create Selector Constants

```typescript
const NEW_SERVICE_SELECTORS = {
  creditScoreSection: '/* your selector */',
  summarySection: '/* your selector */',
  accountSection: '/* your selector */',
  // ... etc
};
```

### Step 4: Implement Extraction Functions

Follow the same pattern:

```typescript
export function parseNewServiceReport(html: string): ExtendedParsedCreditData {
  const $ = cheerio.load(html);
  
  const scores = extractScores($);
  const bureauSummary = extractBureauSummary($);
  // ... etc
  
  return { scores, bureauSummary, /* ... */ };
}
```

### Step 5: Test with Sample File

Create a test script similar to:

```typescript
const html = fs.readFileSync('sample-file.html', 'utf-8');
const result = parseNewServiceReport(html);
console.log('Scores:', result.scores);
// ... verify all fields
```

### Common Differences Between Services

| Aspect | IdentityIQ | Other Services |
|--------|------------|----------------|
| Bureau layout | 4-column table | May use separate sections |
| Account grouping | `<address-history>` element | May use `<div>` or other |
| Class naming | Angular `ng-scope` classes | React/Vue/vanilla patterns |
| Date formats | `MM/DD/YYYY` | May vary |
| Money formats | `$1,234.00` | May vary |

---

## Testing

### Quick Test Script

```typescript
import * as fs from 'fs';
import { parseIdentityIQReport } from './identityiq-parser';

const html = fs.readFileSync('sample.html', 'utf-8');
const result = parseIdentityIQReport(html);

console.log('=== SCORES ===');
console.log('TU:', result.scores.transunion);
console.log('EXP:', result.scores.experian);
console.log('EQ:', result.scores.equifax);

console.log('=== DEROGATORY ===');
console.log('Count:', result.derogatoryAccounts?.length);
result.derogatoryAccounts?.forEach(a => {
  console.log(`  ${a.creditorName}: ${a.uniqueStatus}`);
});
```

### Expected Output Example

```
=== SCORES ===
TU: 509
EXP: 509
EQ: 506

=== DEROGATORY ===
Count: 4
  MACYS/CBNA: Collection/Chargeoff
  CREDITONEBNK: Late 90 Days
  VERIZON: Collection/Chargeoff, Late 120 Days
  KIKOFF LENDING LLC: Collection/Chargeoff
```

---

## Troubleshooting

### Data Not Extracting

1. **Check selectors** - Use browser DevTools to verify CSS selectors match
2. **Check label text** - Labels may have trailing colons, spaces, or different casing
3. **Check cell structure** - Data may be nested in additional divs

### Dates Not Parsing

The parser handles multiple formats:
- `MM/DD/YYYY` (e.g., "3/24/1998")
- `YYYY` (year only)
- Cells with extra content (filters out `-` placeholders)

### Money Values Wrong

All money values are stored in **cents** (multiply by 100). Display should divide by 100.

---

## Reference: PHP Implementation

The TypeScript parser was ported from a PHP implementation in `manage_program/src/Controller/ParserController.php`. Key methods:

- `get_personal_info()` - Consumer profile extraction
- `get_degrogatory_accounts()` - Derogatory detection
- `get_inquiries()` - Inquiry extraction
- `get_public_records()` - Public records
- `get_credit_limits()` - Credit utilization

The PHP system used array indices for row-based extraction, while the TypeScript version uses label text matching for more flexibility.

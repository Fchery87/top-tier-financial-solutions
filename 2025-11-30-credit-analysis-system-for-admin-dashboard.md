## Credit Analysis System - Implementation Spec

### Overview
Add a "Clients" section to the admin dashboard where you can upload credit reports (PDF, HTML) and automatically generate comprehensive credit analysis reports for your credit repair clients.

---

### 1. Database Schema (New Tables)

```typescript
// Clients table (central client management)
clients: {
  id, firstName, lastName, email, phone, status, 
  userId (optional link to user account), createdAt, updatedAt
}

// Credit reports (uploaded files)
creditReports: {
  id, clientId, fileName, fileType, fileUrl, fileSize,
  bureau ('transunion' | 'experian' | 'equifax'),
  reportDate, uploadedAt, parsedAt, rawData (JSON)
}

// Credit accounts/tradelines (parsed from reports)
creditAccounts: {
  id, creditReportId, clientId,
  creditorName, accountNumber (masked), accountType,
  balance, creditLimit, paymentStatus, dateOpened, 
  highCredit, monthlyPayment, pastDueAmount,
  bureau, isNegative, riskLevel, createdAt
}

// Negative items (collections, charge-offs, etc.)
negativeItems: {
  id, creditReportId, clientId,
  itemType, creditorName, amount, dateReported,
  bureau, riskSeverity ('low'|'medium'|'high'|'severe'),
  recommendedAction, disputeStatus, notes
}

// Credit analysis summaries
creditAnalyses: {
  id, clientId, 
  scoreTransunion, scoreExperian, scoreEquifax,
  totalAccounts, openAccounts, closedAccounts,
  totalDebt, totalCreditLimit, utilizationPercent,
  derogatoryCount, collectionsCount, latePaymentCount,
  analysisSummary (JSON), recommendations (JSON),
  createdAt, updatedAt
}

// Dispute tracking (action plan)
disputes: {
  id, clientId, negativeItemId,
  bureau, disputeReason, status, round, sentAt, responseAt,
  outcome, notes, createdAt
}
```

---

### 2. File Upload Strategy

**Recommended: Vercel Blob Storage** (already on Vercel ecosystem)
- Simple integration with Next.js
- Secure, private URLs
- No additional infrastructure

Alternative options: AWS S3, Cloudflare R2, or local storage for development.

Supported formats:
- **PDF** - Most common format (use `pdf-parse` library)
- **HTML** - Credit Karma, AnnualCreditReport.com exports
- **Plain Text** - Some bureau exports

*Note: DOC/DOCX files are rare for credit reports; HTML and PDF cover 99% of cases.*

---

### 3. Credit Report Parsing Approach

**Option A: Manual Parser (Recommended for MVP)**
- Build custom parsers for common formats (Credit Karma HTML, official bureau PDFs)
- Use regex patterns to extract accounts, balances, negative items
- Works offline, no external API costs

**Option B: AI-Assisted Parsing (Enhancement)**
- Send extracted text to OpenAI/Claude for structured data extraction
- More accurate for varied formats
- Additional cost per report

**Option C: Third-Party API Integration (Future)**
- Integrate with services like Credit Repair Cloud API, Array, etc.
- Direct bureau pulls (requires FCRA compliance, expensive)

---

### 4. Admin Dashboard UI Components

#### A. Clients Section (`/admin/clients`)
- Client list with search/filter
- Add new client form
- Client detail view with:
  - Contact info
  - Linked credit reports
  - Analysis history
  - Case/dispute status

#### B. Credit Report Upload (`/admin/clients/[id]/upload`)
- Drag & drop file upload
- Bureau selection (TU/EX/EQ)
- Report date picker
- Upload progress with parsing status

#### C. Credit Analysis View (`/admin/clients/[id]/analysis`)
- **Score Overview**: 3-bureau score cards with trend arrows
- **Account Breakdown**: Table of all tradelines with status badges
- **Negative Items**: Prioritized list with risk severity indicators
- **Utilization Chart**: Visual breakdown of credit usage
- **Score Factors**: Impact analysis of each factor
- **Action Plan**: Recommended disputes and strategies

#### D. Dispute Manager (`/admin/clients/[id]/disputes`)
- Create disputes from negative items
- Track dispute rounds and outcomes
- Generate dispute letter templates (future)

---

### 5. Implementation Phases

**Phase 1: Foundation (Immediate)**
- Database schema migration
- Clients CRUD API and page
- File upload infrastructure
- Admin sidebar navigation update

**Phase 2: Core Analysis (Week 1-2)**
- PDF/HTML parsing logic
- Credit report data extraction
- Analysis algorithm (utilization, risk scoring)
- Basic analysis view UI

**Phase 3: Action Planning (Week 2-3)**
- Negative items categorization
- Dispute tracking system
- Recommendations engine
- Client-facing summary export

**Phase 4: Enhancements (Future)**
- AI-assisted parsing for unknown formats
- Automated dispute letter generation
- Progress tracking over time
- Email notifications to clients

---

### 6. Key Files to Create/Modify

```
New Files:
├── db/schema.ts (add new tables)
├── src/app/admin/clients/
│   ├── page.tsx (client list)
│   └── [id]/
│       ├── page.tsx (client detail)
│       ├── analysis/page.tsx (analysis view)
│       └── disputes/page.tsx (dispute manager)
├── src/app/api/admin/clients/ (CRUD)
├── src/app/api/admin/credit-reports/ (upload, parse)
├── src/app/api/admin/credit-analysis/ (generate)
├── src/lib/parsers/
│   ├── pdf-parser.ts
│   └── html-parser.ts
├── src/lib/credit-analysis.ts (scoring algorithms)
└── src/components/admin/
    ├── ClientCard.tsx
    ├── CreditScoreCard.tsx
    ├── AccountsTable.tsx
    ├── NegativeItemsList.tsx
    └── FileUpload.tsx

Modified Files:
├── src/components/admin/AdminSidebar.tsx (add Clients nav)
└── package.json (add pdf-parse, @vercel/blob)
```

---

### 7. Dependencies to Add

```json
{
  "@vercel/blob": "^0.23.0",      // File storage
  "pdf-parse": "^1.1.1",          // PDF parsing
  "cheerio": "^1.0.0",            // HTML parsing
  "uuid": "^9.0.0"                // Already using randomUUID, but explicit dep
}
```

---

### Questions Before Implementation

1. **File Storage**: Vercel Blob (simplest) or prefer S3/other? Cloudflare R2
2. **Parsing Priority**: Start with PDF-only or both PDF+HTML? both (PDF+HTML)
3. **Client-User Link**: Should clients be linked to registered users (for portal access) or standalone records? Yes clients should be linked to registered user. step should be user signs up as lead, then if they decide to recieve service they are then converted to client (active) which would transition them to the client section, to be able to start services.
4. **Dispute Letters**: Include template generation in MVP or defer? Yes 

---

Would you like me to proceed with Phase 1 (database schema + clients CRUD + file upload)?

## Dispute Letter Generation Engine Enhancement

### Overview
Enhance the existing dispute system with a Dispute Wizard, AI-powered letter generation, and an expanded Letter Library.

---

### Phase 1: AI-Powered Letter Generation

**New Dependency:**
```bash
npm install openai  # or @anthropic-ai/sdk
```

**New Environment Variable:**
```
OPENAI_API_KEY=sk-...
```

**New File: `src/lib/ai-letter-generator.ts`**
- Uses AI to generate unique letter text while preserving legal framework
- Inputs: dispute type, creditor, reason codes, client info
- Outputs: unique, non-templated letter with FCRA citations intact
- Includes variation prompts for tone, sentence structure, and vocabulary

```typescript
// Core function signature
async function generateUniqueDisputeLetter(params: {
  disputeType: string;  // standard, mov, goodwill, debt_validation, etc.
  round: number;        // 1, 2, 3...
  targetRecipient: 'bureau' | 'creditor' | 'collector';
  clientData: ClientInfo;
  itemData: NegativeItemInfo;
  reasonCodes: string[];
}) => Promise<string>
```

**API Endpoint:** `POST /api/admin/disputes/generate-letter`
- Takes dispute parameters
- Returns AI-generated unique letter
- Falls back to templates if AI fails

---

### Phase 2: Dispute Wizard with Round Management

**New Page: `/admin/disputes/wizard`**

Multi-step wizard flow:
1. **Select Client** - Search/select client from list
2. **Select Items** - Check negative items to dispute (supports multi-select)
3. **Choose Round & Target**
   - Round 1: Bureau disputes (TransUnion, Experian, Equifax)
   - Round 2+: Direct to Creditor/Furnisher
   - Round 3+: Collection agency, regulatory escalation
4. **Select Reason Codes** - Pre-defined dispute reasons per item type
5. **Generate Letters** - AI or template-based option
6. **Review & Finalize** - Preview all letters, edit if needed, save/print

**Database Schema Update:**
```sql
-- Add to disputes table
reason_code TEXT,           -- standardized reason code
escalation_path TEXT,       -- 'bureau' | 'creditor' | 'furnisher' | 'collector' | 'cfpb'

-- New table for tracking dispute batches
CREATE TABLE dispute_batches (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  round INTEGER DEFAULT 1,
  items_count INTEGER,
  created_at TIMESTAMP,
  status TEXT DEFAULT 'draft'
);
```

**Reason Code Library:**
Standard codes per item type (collections, late payments, inquiries, etc.)
- "Not mine" / Identity dispute
- "Never late" / Payment history dispute
- "Wrong balance/amount"
- "Account closed by consumer"
- "Obsolete information (7+ years)"
- "Duplicate entry"

---

### Phase 3: Letter Library & Finder

**New Page: `/admin/dispute-templates`**

Features:
- View all 20+ templates in categorized grid
- Search by keyword, dispute type, target recipient
- Filter by: Round (1/2/3+), Target (Bureau/Creditor/Collector), Category
- Preview template content
- Quick-use: Select template → Fill variables → Generate

**Expand Template Collection (add 15+ new templates):**
- Round 2 Creditor Follow-up
- Round 3 CFPB Complaint Letter
- Bankruptcy Removal Request
- Authorized User Removal
- Identity Theft Affidavit Cover Letter
- Judgment Satisfaction Letter
- Tax Lien Withdrawal Request
- Student Loan Rehabilitation Letter
- Medical Debt Dispute
- Inquiries Removal (Hard Pull)
- Mixed File / Wrong Person
- Re-aging Dispute
- Obsolete Debt (7-year rule)
- Fraud Alert Request
- Credit Freeze Request

---

### UI Mockup: Dispute Wizard

```
┌─────────────────────────────────────────────────────────────┐
│  Dispute Wizard                                    Step 3/5 │
├─────────────────────────────────────────────────────────────┤
│  [1. Client] → [2. Items] → [3. Round] → [4. Generate] → [5. Review]
│                                  ↑                          │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Select Dispute Round & Target                          ││
│  │                                                         ││
│  │  ○ Round 1 - Bureau Disputes                           ││
│  │    Initial dispute sent to credit bureaus              ││
│  │    [x] TransUnion  [x] Experian  [x] Equifax          ││
│  │                                                         ││
│  │  ○ Round 2 - Direct to Creditor/Furnisher             ││
│  │    Escalation after bureau verification                ││
│  │                                                         ││
│  │  ○ Round 3+ - Advanced Escalation                      ││
│  │    Collector / CFPB Complaint / Legal                  ││
│  │                                                         ││
│  │  Letter Generation Method:                             ││
│  │  (•) AI-Generated (Unique)   ○ Template-Based          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│                               [← Back]  [Next: Generate →]  │
└─────────────────────────────────────────────────────────────┘
```

---

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/ai-letter-generator.ts` | Create - AI letter generation |
| `src/app/admin/disputes/wizard/page.tsx` | Create - Multi-step wizard UI |
| `src/app/admin/dispute-templates/page.tsx` | Create - Template library UI |
| `src/app/api/admin/disputes/generate-letter/route.ts` | Create - AI generation endpoint |
| `db/schema.ts` | Update - Add dispute_batches, reason_code fields |
| `scripts/seed-dispute-templates.ts` | Update - Add 15+ new templates |
| `src/lib/dispute-letters.ts` | Update - Add reason code mapping |
| `package.json` | Update - Add openai dependency |
| `.env.example` | Update - Add OPENAI_API_KEY |

---

### Estimated Work
- Phase 1 (AI Generation): ~2-3 hours
- Phase 2 (Dispute Wizard): ~3-4 hours  
- Phase 3 (Letter Library): ~2 hours

**Total: ~7-9 hours**

Would you like me to proceed with implementation?

Instead of using OpenAI or Anthropic for the AI generation, I would like to use Gemini 2.5 Flash.

Incorporate CRSA, Metro 2, and FCRA standards. 

The letter should:

Assert my rights under these compliance frameworks,

Highlight violations of proper reporting standards,

Demand full deletion of the disputed account(s), rather than just correction.

Create the letter in 12th grade level, to not appear computer generated and cant be spotted by ai tech.

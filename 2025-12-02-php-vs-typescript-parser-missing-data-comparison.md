## PHP vs TypeScript Parser Comparison

### What PHP Extracts Per Bureau

The PHP system extracts these fields **for each bureau** (TransUnion, Experian, Equifax):

| Field | PHP Extracts | TypeScript Extracts |
|-------|--------------|---------------------|
| Report Date | ✅ Yes | ❌ No |
| Name | ✅ Yes (per bureau) | ⚠️ Aggregated only |
| **Also Known As (AKA)** | ✅ Yes | ❌ **Missing** |
| **Former Name** | ✅ Yes | ❌ **Missing** |
| Date of Birth | ✅ Yes (per bureau) | ⚠️ Single value only |
| Current Address | ✅ Yes (per bureau) | ⚠️ Aggregated only |
| **Previous Address** | ✅ Yes (per bureau) | ❌ **Missing** |
| Employers | ✅ Yes (per bureau) | ⚠️ Aggregated only |
| Credit Score | ✅ Yes | ✅ Yes |
| **Lender Rank** | ✅ Yes | ❌ **Missing** |
| **Score Scale** | ✅ Yes | ❌ **Missing** |
| Total Accounts | ✅ Yes | ✅ Yes |
| Open Accounts | ✅ Yes | ✅ Yes |
| Closed Accounts | ✅ Yes | ✅ Yes |
| Delinquent | ✅ Yes | ✅ Yes |
| Derogatory | ✅ Yes | ✅ Yes |
| Collection | ✅ Yes | ✅ Yes |
| Balances | ✅ Yes | ✅ Yes |
| Payments | ✅ Yes | ✅ Yes |
| Public Records | ✅ Yes | ✅ Yes |
| Inquiries | ✅ Yes | ✅ Yes |

---

### What's Missing (Need to Add)

1. **Report Date** - Per bureau report generation date
2. **Also Known As (AKA)** - Alternative names per bureau
3. **Former Name** - Previous names per bureau
4. **Previous Addresses** - Historical addresses per bureau
5. **Lender Rank** - e.g., "Unfavorable", "Fair", "Good"
6. **Score Scale** - e.g., "300-850"
7. **Per-Bureau Personal Info** - Currently aggregated, should be separated

---

### Implementation Plan

I can update the TypeScript parser to extract all these missing fields:

**1. Update `BureauMetrics` interface:**
```typescript
interface BureauMetrics {
  // Existing fields...
  reportDate?: string;      // Add
  lenderRank?: string;      // Add (interface has it, not populated)
  scoreScale?: string;      // Add (interface has it, not populated)
}
```

**2. Add new `PersonalInfoPerBureau` interface:**
```typescript
interface PersonalInfoPerBureau {
  name?: string;
  alsoKnownAs?: string[];
  formerName?: string[];
  dateOfBirth?: string;
  currentAddress?: string;
  previousAddresses?: string[];
  employers?: string[];
}

interface BureauPersonalInfo {
  transunion: PersonalInfoPerBureau;
  experian: PersonalInfoPerBureau;
  equifax: PersonalInfoPerBureau;
}
```

**3. Update extraction functions** to capture:
- Report Date row
- Also Known As row
- Former row
- Previous Address(es) row
- Lender Rank row
- Score Scale row

---

### Estimated Changes

| File | Changes |
|------|---------|
| `pdf-parser.ts` | Add new interfaces |
| `identityiq-parser.ts` | Update extraction to capture missing fields |

Shall I proceed with adding these missing fields?
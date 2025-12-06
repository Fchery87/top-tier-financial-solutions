# How to See the New Personal Info & Inquiry Dispute Features

## What Was Implemented

All the code for personal information disputes and inquiry disputes is **fully implemented**:

1. ✅ Database tables (`personal_info_disputes` and `inquiry_disputes`) 
2. ✅ Wizard UI with tabs (Tradelines, Personal Info, Inquiries)
3. ✅ API endpoints that return the data
4. ✅ Parser that extracts data from IdentityIQ reports
5. ✅ Ingestion logic that saves to database

## Why You Don't See It Yet

The new database tables are **empty** because they were just created. Existing credit reports were analyzed **before** these tables existed, so they don't have any data in them.

## How to Populate the Data

### Option 1: Re-analyze an Existing Credit Report

1. Go to **Admin > Clients**
2. Click on any client (e.g., the one with ID `bac00097-816f-42dd-8a62-5413dd5cbaa4`)
3. Scroll to the **Credit Reports** section
4. Find a report with `parse_status: completed`
5. Click the **"Re-analyze"** button next to it
6. Wait for the analysis to complete (watch the spinner)

### Option 2: Upload a New Credit Report

1. Go to **Admin > Clients**
2. Click on a client
3. Upload a new IdentityIQ credit report HTML file
4. Click **"Analyze"** when it appears
5. Wait for analysis to complete

## What You'll See After Re-analyzing

### 1. In the Client Detail Page

When you navigate to `/api/admin/clients/{clientId}` in your browser Network tab, you'll see:

```json
{
  "personal_info_disputes": [
    {
      "id": "...",
      "bureau": "transunion",
      "type": "name",
      "value": "JOHN DOE",
      "created_at": "..."
    }
  ],
  "inquiry_disputes": [
    {
      "id": "...",
      "creditor_name": "CAPITAL ONE",
      "bureau": "experian",
      "inquiry_date": "2023-01-15",
      "inquiry_type": "hard",
      "is_past_fcra_limit": true,
      "days_since_inquiry": 850,
      "created_at": "..."
    }
  ]
}
```

### 2. In the Dispute Wizard

Navigate to **Admin > Disputes > Wizard** after re-analyzing:

**Step 2 - Select Items:**
- You'll see **three tabs**: 
  - `Tradelines (N)` - negative credit items
  - `Personal Info (M)` - name/DOB/address discrepancies
  - `Inquiries (K)` - inquiries, with FCRA violation badges
  
- Click between tabs to see different item types
- Each tab has its own select/deselect all button
- The total selection count combines all three tabs

**Personal Info Tab:**
- Shows items like:
  - Name discrepancies per bureau
  - DOB discrepancies per bureau  
  - Address discrepancies per bureau
- Each item shows which bureau it's from

**Inquiries Tab:**
- Shows credit inquiries
- Items past 2-year FCRA limit show a **violation badge**
- Each item shows bureau, date, and type
- Auto-calculates days since inquiry

### 3. In Generated Letters

When you generate letters with personal info or inquiries selected:
- Letters include all three types of items
- Personal info gets auto-reason: `verification_required`, `inaccurate_reporting`
- Inquiries past FCRA limit get auto-reason: `obsolete`  
- Other inquiries get auto-reason: `unauthorized_inquiry`

## Troubleshooting

### "I re-analyzed but still don't see data"

**Check 1**: Is it an IdentityIQ report?
- Only IdentityIQ HTML reports populate these fields currently
- PDF reports may not extract personal info discrepancies

**Check 2**: Does the report have discrepancies?
- Not all reports have personal info errors or old inquiries
- Try a different client/report

**Check 3**: Check the browser console
- Look for any error messages when fetching `/api/admin/clients/{id}`
- Look for errors when loading the wizard page

### "The tabs show 0 items"

This means:
- The report was re-analyzed successfully
- But it didn't find any personal info discrepancies or inquiries to dispute
- This is normal for clean reports

Try:
- Re-analyzing a report from a client with more issues
- Looking at the C_Pique report (if available) which typically has discrepancies

## Next Steps

1. **Re-analyze** at least one credit report using the steps above
2. **Refresh** the dispute wizard page
3. **Check** if you see the three tabs with counts > 0
4. **Test** selecting items from each tab and generating a letter

If you still don't see data after re-analyzing, let me know which client/report you tried and I can help debug further.

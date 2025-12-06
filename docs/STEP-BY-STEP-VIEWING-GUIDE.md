# Step-by-Step Guide to See the New Features

## The Data is Ready! ✅

Your database has:
- **15 Personal Info Disputes** for Cristal Pique (name/DOB/address discrepancies)
- **18 Inquiry Disputes** for Cristal Pique (ALL with FCRA violations!)
- **5+ Negative Items** (tradelines)

## How to View in the Wizard

### Step 1: Open the Dispute Wizard
1. Make sure your dev server is running: `npm run dev`
2. Go to: `http://localhost:3000/admin/disputes/wizard`

### Step 2: Select Client
1. You should see "Step 1: Select Client"
2. In the search box, type "Cristal" or "Pique"
3. Click on **Cristal Pique** (john@example.com)
4. Click the **"Next"** button at the bottom

### Step 3: View the Tabs (THIS IS THE NEW FEATURE!)
After clicking Next, you should see **Step 2: Select Items to Dispute**

**Look for these three tabs at the top:**
```
[ Tradelines (5+) ] [ Personal Info (15) ] [ Inquiries (18) ]
```

**On the right side, you should see:**
```
Selected: 0
```

### Step 4: Explore Each Tab

#### Tradelines Tab (Default)
- Should show negative items like "CB/VICSCRT", "CAP ONE AUTO", etc.
- Each item shows "Bureaus: TU/EXP/EQ" chips

#### Personal Info Tab
- Click the **"Personal Info (15)"** tab
- You should see 15 items like:
  - `[TRANSUNION] name: "CHRISTAL C PIQUE"`
  - `[TRANSUNION] date_of_birth: "6/8/1986"`
  - `[EXPERIAN] name: "CHRISTAL PIQUE"`
  - etc.
- Each shows which bureau and what type (name, DOB, address, employer)

#### Inquiries Tab
- Click the **"Inquiries (18)"** tab
- You should see 18 inquiries like:
  - `COMCAST` - with a red **"⚠️ FCRA VIOLATION"** badge
  - `NAVY FCU` - with a red **"⚠️ FCRA VIOLATION"** badge
  - etc.
- ALL 18 should have the FCRA violation badge (they're all > 2 years old)

### Step 5: Test Selection
1. Click on a few items in each tab
2. Watch the "Selected: X" counter update
3. Click **"Select All"** button in each tab
4. The counter should combine all selections from all tabs

### Step 6: Generate a Letter (Optional)
1. Select at least one item from any tab
2. Click **"Next"** to go to Step 3 (Method & Target)
3. Click **"Next"** again to go to Step 4 (Review)
4. You should see your selected items listed, including personal info and inquiries
5. Click **"Generate Letters"** to create dispute letters

## Troubleshooting

### "I don't see the tabs"

**Check 1: Browser Cache**
- Hard refresh: `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (Mac)
- Or clear browser cache completely

**Check 2: Network Request**
1. Open DevTools (F12)
2. Go to **Network** tab
3. Select Cristal Pique in the wizard
4. Look for: `/api/admin/clients/bac00097-816f-42dd-8a62-5413dd5cbaa4`
5. Click on it and view the **Response** tab
6. Search for `personal_info_disputes` - you should see an array with 15 items
7. Search for `inquiry_disputes` - you should see an array with 18 items

**Check 3: Console Errors**
1. In DevTools, go to **Console** tab
2. Look for any red error messages
3. If you see errors, copy and share them

### "The tabs show but counts are (0)"

If you see:
```
[ Tradelines (0) ] [ Personal Info (0) ] [ Inquiries (0) ]
```

This means the wizard isn't loading the data from the API. Check:
1. Is the client selected? (Should show name at top)
2. Any errors in the Console tab?
3. Did the Network request succeed? (Status 200)

### "I see some data but not all"

If you see tradelines but no personal info/inquiries:
1. Check the Network response - does it include `personal_info_disputes` and `inquiry_disputes` arrays?
2. Check the Console for JavaScript errors
3. Try a different client (e.g., Sakeemah Harrison)

## What Each Feature Does

### Personal Info Disputes
- Lets you dispute incorrect personal information (names, DOB, addresses, employers)
- Each item shows which bureau it's from
- Auto-generates dispute reasons when you select them
- Includes them in the generated letter

### Inquiry Disputes
- Lets you dispute credit inquiries
- Shows **FCRA violation** badge for inquiries > 2 years old
- Auto-uses "obsolete" reason for violations
- Auto-uses "unauthorized_inquiry" for recent inquiries
- Includes them in the generated letter

### Combined Generation
- You can select items from all three tabs
- The letter will include all selected items
- Proper reasons are auto-assigned based on item type
- Works with both "AI" and "Template" generation methods

## Next Steps

Once you verify you can see the features:
1. ✅ Test selecting items from each tab
2. ✅ Test generating a letter with mixed items
3. ✅ Test the "Select All" button in each tab
4. ✅ Verify the generated letters include personal info and inquiries

If you still don't see the features after following this guide, take a screenshot of:
1. The wizard page after selecting Cristal Pique
2. The DevTools Network tab showing the API response
3. The DevTools Console tab showing any errors

Then we can debug further!

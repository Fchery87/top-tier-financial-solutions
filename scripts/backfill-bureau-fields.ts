/**
 * Backfill Migration Script: Per-Bureau Presence Fields
 * 
 * This script populates the new per-bureau boolean fields (on_transunion, on_experian, on_equifax)
 * for existing credit_accounts and negative_items records based on their legacy `bureau` field.
 * 
 * Logic:
 * - If bureau is 'transunion': set on_transunion = true, others = false
 * - If bureau is 'experian': set on_experian = true, others = false
 * - If bureau is 'equifax': set on_equifax = true, others = false
 * - If bureau is 'combined' or null: set all to true (conservative - item may appear on all bureaus)
 * 
 * Run with: npx tsx scripts/backfill-bureau-fields.ts
 */

import { db } from '../db/client';
import { creditAccounts, negativeItems } from '../db/schema';
import { isNull, or, eq } from 'drizzle-orm';

async function backfillBureauFields() {
  console.log('Starting backfill of per-bureau presence fields...\n');

  // Backfill credit_accounts
  console.log('Backfilling credit_accounts...');
  const allAccounts = await db.select().from(creditAccounts);
  let accountsUpdated = 0;

  for (const account of allAccounts) {
    // Skip if already has per-bureau data
    if (account.onTransunion !== null || account.onExperian !== null || account.onEquifax !== null) {
      continue;
    }

    const bureau = account.bureau?.toLowerCase();
    let onTransunion = false;
    let onExperian = false;
    let onEquifax = false;

    if (!bureau || bureau === 'combined') {
      // Conservative: mark all as true
      onTransunion = true;
      onExperian = true;
      onEquifax = true;
    } else if (bureau === 'transunion') {
      onTransunion = true;
    } else if (bureau === 'experian') {
      onExperian = true;
    } else if (bureau === 'equifax') {
      onEquifax = true;
    } else {
      // Unknown bureau - mark all as true
      onTransunion = true;
      onExperian = true;
      onEquifax = true;
    }

    await db.update(creditAccounts)
      .set({
        onTransunion,
        onExperian,
        onEquifax,
        // Copy balance and date to the appropriate bureau field
        transunionDate: onTransunion ? account.dateReported : null,
        experianDate: onExperian ? account.dateReported : null,
        equifaxDate: onEquifax ? account.dateReported : null,
        transunionBalance: onTransunion ? account.balance : null,
        experianBalance: onExperian ? account.balance : null,
        equifaxBalance: onEquifax ? account.balance : null,
      })
      .where(eq(creditAccounts.id, account.id));

    accountsUpdated++;
  }

  console.log(`  Updated ${accountsUpdated} credit accounts\n`);

  // Backfill negative_items
  console.log('Backfilling negative_items...');
  const allItems = await db.select().from(negativeItems);
  let itemsUpdated = 0;

  for (const item of allItems) {
    // Skip if already has per-bureau data
    if (item.onTransunion !== null || item.onExperian !== null || item.onEquifax !== null) {
      continue;
    }

    const bureau = item.bureau?.toLowerCase();
    let onTransunion = false;
    let onExperian = false;
    let onEquifax = false;

    if (!bureau || bureau === 'combined') {
      // Conservative: mark all as true
      onTransunion = true;
      onExperian = true;
      onEquifax = true;
    } else if (bureau === 'transunion') {
      onTransunion = true;
    } else if (bureau === 'experian') {
      onExperian = true;
    } else if (bureau === 'equifax') {
      onEquifax = true;
    } else {
      // Unknown bureau - mark all as true
      onTransunion = true;
      onExperian = true;
      onEquifax = true;
    }

    await db.update(negativeItems)
      .set({
        onTransunion,
        onExperian,
        onEquifax,
        // Copy date to the appropriate bureau field
        transunionDate: onTransunion ? item.dateReported : null,
        experianDate: onExperian ? item.dateReported : null,
        equifaxDate: onEquifax ? item.dateReported : null,
      })
      .where(eq(negativeItems.id, item.id));

    itemsUpdated++;
  }

  console.log(`  Updated ${itemsUpdated} negative items\n`);

  console.log('Backfill complete!');
  console.log(`Summary:`);
  console.log(`  - Credit accounts: ${accountsUpdated} updated`);
  console.log(`  - Negative items: ${itemsUpdated} updated`);
}

// Run the backfill
backfillBureauFields()
  .then(() => {
    console.log('\nBackfill completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });

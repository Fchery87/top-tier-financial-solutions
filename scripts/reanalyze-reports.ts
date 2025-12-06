/**
 * Re-analyze Credit Reports Script
 * 
 * This script re-analyzes all credit reports to properly extract and save
 * per-bureau data from the derogatoryAccounts field.
 * 
 * Run with: npx tsx scripts/reanalyze-reports.ts
 */

import { db } from '../db/client';
import { creditReports } from '../db/schema';
import { analyzeCreditReport } from '../src/lib/credit-analysis';
import { eq } from 'drizzle-orm';

async function reanalyzeReports() {
  console.log('=== Re-analyzing Credit Reports ===\n');

  // Get all credit reports with parsed status
  const reports = await db
    .select()
    .from(creditReports)
    .where(eq(creditReports.parseStatus, 'completed'));

  console.log(`Found ${reports.length} completed reports to re-analyze.\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const report of reports) {
    console.log(`Processing: ${report.fileName} (ID: ${report.id})`);
    console.log(`  Client: ${report.clientId}`);
    console.log(`  Type: ${report.fileType}`);
    
    try {
      await analyzeCreditReport(report.id);
      console.log(`  ✓ Re-analyzed successfully\n`);
      successCount++;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(`  ✗ Error: ${message}\n`);
      errorCount++;
    }
  }

  console.log('=== Summary ===');
  console.log(`Success: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total: ${reports.length}`);
}

reanalyzeReports()
  .then(() => {
    console.log('\nRe-analysis complete!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Re-analysis failed:', err);
    process.exit(1);
  });

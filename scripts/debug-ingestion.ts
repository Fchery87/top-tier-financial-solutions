import * as dotenv from 'dotenv';
import { join } from 'path';
import { db } from '../db/client';
import {
  creditReports,
  negativeItems,
  personalInfoDisputes,
  inquiryDisputes,
} from '../db/schema';
import { and, desc, eq } from 'drizzle-orm';

dotenv.config({ path: join(__dirname, '..', '.env') });

async function main() {
  const clientId = process.argv[2];
  if (!clientId) {
    console.error('Usage: npx tsx scripts/debug-ingestion.ts <clientId>');
    process.exit(1);
  }

  console.log('Debugging ingestion for client:', clientId);

  const reports = await db
    .select()
    .from(creditReports)
    .where(eq(creditReports.clientId, clientId))
    .orderBy(desc(creditReports.uploadedAt));

  console.log('\nCredit reports:');
  for (const r of reports) {
    console.log('-', r.id, r.bureau, r.fileType, r.reportDate?.toISOString(), r.parseStatus);
  }

  const negatives = await db
    .select()
    .from(negativeItems)
    .where(eq(negativeItems.clientId, clientId));

  console.log(`\nNegative items count: ${negatives.length}`);
  const byReport: Record<string, number> = {};
  for (const n of negatives) {
    const key = n.creditReportId ?? 'none';
    byReport[key] = (byReport[key] ?? 0) + 1;
  }
  console.log('Negative items by reportId:', byReport);

  const pii = await db
    .select()
    .from(personalInfoDisputes)
    .where(eq(personalInfoDisputes.clientId, clientId));

  console.log(`\nPersonal info disputes count: ${pii.length}`);
  if (pii.length > 0) {
    console.log('Sample PII disputes:', pii.slice(0, 5));
  }

  const inq = await db
    .select()
    .from(inquiryDisputes)
    .where(eq(inquiryDisputes.clientId, clientId));

  console.log(`\nInquiry disputes count: ${inq.length}`);
  if (inq.length > 0) {
    console.log('Sample inquiries:', inq.slice(0, 5));
  }

  // Also check for rows tied only to the latest report
  if (reports[0]) {
    const latestId = reports[0].id;
    const latestNegatives = await db
      .select()
      .from(negativeItems)
      .where(and(eq(negativeItems.clientId, clientId), eq(negativeItems.creditReportId, latestId)));
    console.log(`\nNegative items on latest report (${latestId}): ${latestNegatives.length}`);

    const latestPii = await db
      .select()
      .from(personalInfoDisputes)
      .where(and(eq(personalInfoDisputes.clientId, clientId), eq(personalInfoDisputes.creditReportId, latestId)));
    console.log(`Personal info disputes on latest report: ${latestPii.length}`);

    const latestInq = await db
      .select()
      .from(inquiryDisputes)
      .where(and(eq(inquiryDisputes.clientId, clientId), eq(inquiryDisputes.creditReportId, latestId)));
    console.log(`Inquiry disputes on latest report: ${latestInq.length}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

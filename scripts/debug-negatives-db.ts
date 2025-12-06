import * as dotenv from 'dotenv';
import { join } from 'path';
import { db } from '../db/client';
import { negativeItems } from '../db/schema';
import { eq } from 'drizzle-orm';

dotenv.config({ path: join(__dirname, '..', '.env') });

async function main() {
  const reportId = process.argv[2];
  if (!reportId) {
    console.error('Usage: npx tsx scripts/debug-negatives-db.ts <reportId>');
    process.exit(1);
  }

  const items = await db.select().from(negativeItems).where(eq(negativeItems.creditReportId, reportId));
  console.log('DB negativeItems count:', items.length);
  const byKey: Record<string, number> = {};
  for (const item of items) {
    const key = `${item.itemType}|${item.creditorName}`;
    byKey[key] = (byKey[key] ?? 0) + 1;
  }
  console.log('Counts by type|creditor:', byKey);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

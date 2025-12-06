import * as fs from 'fs';
import * as path from 'path';
import { parseHtmlCreditReport } from '../src/lib/parsers/html-parser';
import type { ExtendedParsedCreditData } from '../src/lib/parsers/pdf-parser';

async function main() {
  const filePath = path.join(__dirname, '..', 'C_Pique_creditReport.html');
  const html = fs.readFileSync(filePath, 'utf8');
  const parsed = parseHtmlCreditReport(html) as ExtendedParsedCreditData;

  console.log('Parsed negativeItems:', parsed.negativeItems.length);
  const counts: Record<string, number> = {};
  for (const item of parsed.negativeItems) {
    const key = `${item.itemType}|${item.creditorName}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  console.log('Counts by type|creditor:', counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

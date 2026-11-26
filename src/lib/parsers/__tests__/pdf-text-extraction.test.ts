// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePdfCreditReport } from '../pdf-parser';

/** Builds a minimal valid PDF with one line of Helvetica text per page. */
function buildPdf(pageTexts: string[]): Buffer {
  const objects: string[] = [];
  const pageCount = pageTexts.length;
  const kids = pageTexts.map((_, i) => `${3 + i * 2} 0 R`).join(' ');
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);
  pageTexts.forEach((text, i) => {
    const contentId = 4 + i * 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${3 + pageCount * 2} 0 R >> >> >>`,
    );
    const stream = `BT /F1 14 Tf 72 700 Td (${text}) Tj ET`;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => {
    pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

describe('PDF text extraction (pdf-parse wrapper)', () => {
  it('extracts text from every page and feeds the score parser', async () => {
    const result = await parsePdfCreditReport(
      buildPdf(['TransUnion: 612 Equifax: 618', 'Experian: 605']),
    );

    expect(result.rawText).toContain('TransUnion');
    expect(result.rawText).toContain('Experian');
    expect(result.scores).toEqual({ transunion: 612, equifax: 618, experian: 605 });
  });

  it('does not inject page-boundary markers between pages', async () => {
    const result = await parsePdfCreditReport(buildPdf(['First page text', 'Second page text']));

    expect(result.rawText).not.toMatch(/--\s*\d+\s*of\s*\d+\s*--/);
    expect(result.rawText).toContain('First page text');
    expect(result.rawText).toContain('Second page text');
  });
});

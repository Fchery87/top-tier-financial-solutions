// @vitest-environment node

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = process.cwd();
const inventoryPath = join(
  repositoryRoot,
  'docs/architecture/2026-08-09-post-workspace-seam-inventory.md',
);

describe('post-workspace module contracts', () => {
  it('documents and preserves the current workspace, letter, and report seams', () => {
    expect(existsSync(inventoryPath)).toBe(true);

    if (!existsSync(inventoryPath)) {
      return;
    }

    const inventory = readFileSync(inventoryPath, 'utf8');
    const workspaceRouteRoot = join(repositoryRoot, 'src/app/api/workspace');
    const retiredAdminRouteRoot = join(repositoryRoot, 'src/app/api/admin');
    const letterRoute = join(
      workspaceRouteRoot,
      'disputes/generate-letter/route.ts',
    );
    const letterGenerator = join(repositoryRoot, 'src/lib/ai-letter-generator.ts');
    const identityIqParser = join(repositoryRoot, 'src/lib/parsers/identityiq-parser.ts');
    const creditAnalysisReport = join(repositoryRoot, 'src/lib/credit-analysis-report.ts');

    expect(existsSync(workspaceRouteRoot)).toBe(true);
    expect(existsSync(retiredAdminRouteRoot)).toBe(false);
    expect(inventory).toContain('`src/app/api/workspace`');
    expect(inventory).toContain('`src/app/api/admin`');
    expect(inventory).toContain('`buildManualLetterPrompt`');
    expect(inventory).toContain('`parseIdentityIQReport`');
    expect(inventory).toContain('`generateCreditAnalysisReportHTML`');

    expect(readFileSync(letterRoute, 'utf8')).toContain('export async function POST');
    expect(readFileSync(letterGenerator, 'utf8')).toContain(
      'export function buildManualLetterPrompt',
    );
    expect(readFileSync(identityIqParser, 'utf8')).toContain(
      'export function parseIdentityIQReport',
    );
    expect(readFileSync(creditAnalysisReport, 'utf8')).toContain(
      'export function generateCreditAnalysisReportHTML',
    );
  });
});

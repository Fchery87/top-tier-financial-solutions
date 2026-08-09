// @vitest-environment node

import { existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const appRoot = join(process.cwd(), 'src', 'app', 'api');
const canonicalRouteRoot = join(appRoot, 'workspace');
const legacyRouteRoot = join(appRoot, 'admin');

const expectedRoutePaths = `agreements/[id]/route.ts
agreements/route.ts
agreements/sign/route.ts
automation/dispute-escalations/run/route.ts
automation/route.ts
billing/route.ts
blog-categories/route.ts
blog-posts/[id]/route.ts
blog-posts/route.ts
cases/route.ts
client-outcome-analytics/route.ts
clients/[id]/audit-report/route.ts
clients/[id]/compare-reports/route.ts
clients/[id]/nudge/route.ts
clients/[id]/route.ts
clients/documents/route.ts
clients/route.ts
credit-report-pulls/route.ts
credit-reports/[id]/parse/route.ts
credit-reports/[id]/route.ts
credit-reports/upload/route.ts
dashboard/calendar/route.ts
dashboard/pipeline/route.ts
dashboard/trends/route.ts
disclaimers/[id]/route.ts
disclaimers/route.ts
dispute-cycles/route.ts
disputes/[id]/cfpb-eligibility/route.ts
disputes/[id]/letter/lint/route.ts
disputes/[id]/letter/revisions/[revisionId]/revert/route.ts
disputes/[id]/letter/rewrite/route.ts
disputes/[id]/letter/route.ts
disputes/[id]/quick-redispute/route.ts
disputes/[id]/route.ts
disputes/analyze-items/route.ts
disputes/auto-select/route.ts
disputes/discrepancies/route.ts
disputes/draft/route.ts
disputes/drafts/generate/route.ts
disputes/evidence/route.ts
disputes/evidence/upload/route.ts
disputes/generate-letter/route.ts
disputes/insights/creditor-strategies/route.ts
disputes/insights/route.ts
disputes/methodologies/route.ts
disputes/route.ts
disputes/triage/route.ts
email-templates/route.ts
evidence-packets/route.ts
faqs/[id]/route.ts
faqs/route.ts
leads/[id]/route.ts
leads/route.ts
letter-library/[id]/route.ts
letter-library/route.ts
messages/attachments/route.ts
messages/route.ts
notes/[id]/route.ts
notes/route.ts
operator-analytics/route.ts
pages/[id]/route.ts
pages/route.ts
results/route.ts
search/route.ts
service-engagements/[id]/compliance-gate/route.ts
service-engagements/route.ts
services-rendered-events/route.ts
services/[id]/route.ts
services/route.ts
set-role/route.ts
settings/llm/route.ts
settings/llm/test/route.ts
settings/route.ts
stats/route.ts
subscribers/route.ts
tasks/[id]/route.ts
tasks/route.ts
team/route.ts
testimonials/[id]/route.ts
testimonials/route.ts`.split('\n');

describe('workspace API route tree', () => {
  it('contains every canonical workspace handler and no physical admin handler tree', () => {
    expect(collectRoutePaths(canonicalRouteRoot)).toEqual(expectedRoutePaths);
    expect(existsSync(legacyRouteRoot)).toBe(false);
  });
});

function collectRoutePaths(root: string): string[] {
  if (!existsSync(root)) return [];

  const entries = readdirSync(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name === 'route.ts')
    .map((entry) => relative(root, join(entry.parentPath, entry.name)))
    .sort();
}

import { describe, expect, it } from 'vitest';
import { buildDiscrepanciesUrl } from '../useDisputeIntelligence';

describe('buildDiscrepanciesUrl', () => {
  it('builds a client-only discrepancies URL by default', () => {
    expect(buildDiscrepanciesUrl('client-1')).toBe('/api/admin/disputes/discrepancies?clientId=client-1');
  });

  it('includes reportId when provided', () => {
    expect(buildDiscrepanciesUrl('client-1', 'report-1')).toBe('/api/admin/disputes/discrepancies?clientId=client-1&reportId=report-1');
  });
});

import { describe, expect, it } from 'vitest';

import {
  buildDeprecatedLetterTableAudit,
} from '@/lib/deprecated-letter-table-audit';

describe('deprecated letter table audit', () => {
  it('reports retention as intentional and never recommends a destructive drop', () => {
    expect(buildDeprecatedLetterTableAudit({
      deprecatedRows: 65,
      activeDeprecatedRows: 65,
      activeLibraryRows: 20,
    })).toEqual({
      table: 'dispute_letter_templates',
      deprecatedRows: 65,
      activeDeprecatedRows: 65,
      activeLibraryRows: 20,
      retainedForCompatibility: true,
      dropRecommended: false,
    });
  });
});

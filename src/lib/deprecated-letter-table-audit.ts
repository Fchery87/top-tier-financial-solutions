export type DeprecatedLetterTableAudit = {
  table: 'dispute_letter_templates';
  deprecatedRows: number;
  activeDeprecatedRows: number;
  activeLibraryRows: number;
  retainedForCompatibility: true;
  dropRecommended: false;
};

type DeprecatedLetterTableCounts = {
  deprecatedRows: number;
  activeDeprecatedRows: number;
  activeLibraryRows: number;
};

export function buildDeprecatedLetterTableAudit({
  deprecatedRows,
  activeDeprecatedRows,
  activeLibraryRows,
}: DeprecatedLetterTableCounts): DeprecatedLetterTableAudit {
  return {
    table: 'dispute_letter_templates',
    deprecatedRows,
    activeDeprecatedRows,
    activeLibraryRows,
    retainedForCompatibility: true,
    dropRecommended: false,
  };
}

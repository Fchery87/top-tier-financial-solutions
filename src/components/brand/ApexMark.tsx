/**
 * "Apex" mark — nested upward chevrons forming a peak (top tier / summit).
 * Ink rounded tile, white outer chevron, indigo inner chevron. Consistent
 * across light + dark surfaces and crisp down to favicon size.
 */
export function ApexMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="#18181B" stroke="rgba(255,255,255,0.10)" />
      <path d="M6 23 L16 9 L26 23" stroke="#FFFFFF" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M11.5 23 L16 16.5 L20.5 23" stroke="#8A90F0" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Backward-compatible alias for existing imports. */
export const AscendantMark = ApexMark;

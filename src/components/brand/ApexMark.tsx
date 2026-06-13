/**
 * "Apex" mark — nested upward chevrons forming a peak (top tier / summit).
 * Warm ink rounded tile, paper outer chevron, brass inner chevron. Consistent
 * across light + dark surfaces and crisp down to favicon size.
 */
export function ApexMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="31" rx="8" fill="#1D1A17" stroke="rgba(236,192,86,0.22)" />
      <path d="M6 23 L16 9 L26 23" stroke="#FAF8F4" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M11.5 23 L16 16.5 L20.5 23" stroke="#ECC056" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Backward-compatible alias for existing imports. */
export const AscendantMark = ApexMark;

import * as React from 'react';

/**
 * "Ascendant" mark — three ascending columns rising to an emerald apex.
 * Reads as rising credit score / "top tier". Emerald-on-near-black app icon.
 * Use `idSuffix` when rendering multiple instances on one page to keep
 * the gradient id unique.
 */
export function AscendantMark({
  className,
  idSuffix = 'sb',
}: {
  className?: string;
  idSuffix?: string;
}) {
  const gradId = `ascendant-emerald-${idSuffix}`;
  return (
    <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="20" y1="80" x2="76" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#34D399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="92" height="92" rx="24" fill="#0B0F14" stroke="rgba(52,211,153,0.30)" strokeWidth="1.5" />
      <rect x="26" y="52" width="13" height="22" rx="3" fill="#E2E8F0" opacity="0.55" />
      <rect x="42" y="40" width="13" height="34" rx="3" fill="#E2E8F0" opacity="0.78" />
      <rect x="58" y="22" width="13" height="52" rx="3" fill={`url(#${gradId})`} />
      <circle cx="64.5" cy="17" r="4.5" fill="#34D399" />
    </svg>
  );
}

export function getSafeFullName(first?: string | null, last?: string | null): string {
  return [first, last].filter(Boolean).join(' ') || 'Unknown Client';
}

export function getSafeInitials(first?: string | null, last?: string | null): string {
  const f = (first || '')[0] || '';
  const l = (last || '')[0] || '';
  return (f + l).toUpperCase() || '?';
}

const LEGACY_API_PREFIX = '/api/admin/';
const CANONICAL_API_PREFIX = '/api/workspace/';
const LEGACY_API_SUNSET_AT = new Date('2026-11-07T00:00:00.000Z');

export const LEGACY_API_SUNSET_HEADER = 'Fri, 07 Nov 2026 00:00:00 GMT';

export type ApiWorkspaceNamespaceResolution =
  | { kind: 'canonical' }
  | { kind: 'rewrite'; destination: string; sunset: string }
  | { kind: 'gone' };

export function resolveApiWorkspaceNamespace(input: {
  pathname: string;
  search: string;
  now: Date;
}): ApiWorkspaceNamespaceResolution {
  if (!input.pathname.startsWith(LEGACY_API_PREFIX)) {
    return { kind: 'canonical' };
  }

  if (input.now >= LEGACY_API_SUNSET_AT) {
    return { kind: 'gone' };
  }

  return {
    kind: 'rewrite',
    destination: `${CANONICAL_API_PREFIX}${input.pathname.slice(LEGACY_API_PREFIX.length)}${input.search}`,
    sunset: LEGACY_API_SUNSET_HEADER,
  };
}

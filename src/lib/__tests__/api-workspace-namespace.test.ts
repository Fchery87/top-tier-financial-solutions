// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { resolveApiWorkspaceNamespace } from '@/lib/api-workspace-namespace';

const beforeSunset = new Date('2026-11-06T23:59:59.999Z');
const atSunset = new Date('2026-11-07T00:00:00.000Z');

describe('API workspace namespace policy', () => {
  it('rewrites a legacy API path and preserves its query string before the sunset', () => {
    expect(resolveApiWorkspaceNamespace({
      pathname: '/api/admin/clients/client-1',
      search: '?include=reports&limit=10',
      now: beforeSunset,
    })).toEqual({
      kind: 'rewrite',
      destination: '/api/workspace/clients/client-1?include=reports&limit=10',
      sunset: 'Fri, 07 Nov 2026 00:00:00 GMT',
    });
  });

  it('leaves a canonical workspace API path unchanged', () => {
    expect(resolveApiWorkspaceNamespace({
      pathname: '/api/workspace/clients',
      search: '',
      now: beforeSunset,
    })).toEqual({ kind: 'canonical' });
  });

  it('does not treat an admin page or namespace root as a legacy API route', () => {
    expect(resolveApiWorkspaceNamespace({
      pathname: '/admin/settings',
      search: '',
      now: beforeSunset,
    })).toEqual({ kind: 'canonical' });
    expect(resolveApiWorkspaceNamespace({
      pathname: '/api/admin',
      search: '',
      now: beforeSunset,
    })).toEqual({ kind: 'canonical' });
  });

  it('retires legacy API paths at the announced sunset', () => {
    expect(resolveApiWorkspaceNamespace({
      pathname: '/api/admin/disputes',
      search: '',
      now: atSunset,
    })).toEqual({ kind: 'gone' });
  });
});

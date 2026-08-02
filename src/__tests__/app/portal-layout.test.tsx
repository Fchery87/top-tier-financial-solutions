import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('@/lib/admin-auth', () => ({ getUserRole: vi.fn() }));
vi.mock('@/components/portal/PortalHeader', () => ({ default: () => <div data-testid="portal-header" /> }));
vi.mock('@/components/portal/PortalNav', () => ({ default: () => <div data-testid="portal-nav" /> }));

class RedirectSignal extends Error {
  constructor(public readonly url: string) {
    super(`REDIRECT:${url}`);
  }
}

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectSignal(url);
  }),
}));

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/admin-auth';
import PortalLayout from '@/app/portal/layout';

const children = <div data-testid="child">child content</div>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(redirect).mockImplementation((url: string) => {
    throw new RedirectSignal(url);
  });
});

describe('PortalLayout', () => {
  it('redirects unauthenticated visitors to sign in with the portal destination', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    await expect(PortalLayout({ children })).rejects.toThrow('REDIRECT:/sign-in?next=/portal');
    expect(getUserRole).not.toHaveBeenCalled();
  });

  it('redirects team roles to the workspace', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'staff-1', email: 'staff@example.com', name: 'Staff Member' },
    } as never);
    vi.mocked(getUserRole).mockResolvedValue('staff');

    await expect(PortalLayout({ children })).rejects.toThrow('REDIRECT:/workspace');
    expect(getUserRole).toHaveBeenCalledWith('staff@example.com');
  });

  it('renders the portal shell for a client role', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'client-1', email: 'client@example.com', name: 'Client Person' },
    } as never);
    vi.mocked(getUserRole).mockResolvedValue('user');

    const element = await PortalLayout({ children });

    expect(redirect).not.toHaveBeenCalled();
    expect(element.props.children).toHaveLength(3);
    expect(element.props.children[2]).toBe(children);
  });
});

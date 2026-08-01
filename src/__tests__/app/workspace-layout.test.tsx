import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock('@/lib/admin-auth', () => ({ getUserRole: vi.fn() }));
vi.mock('@/components/workspace/WorkspaceShell', () => ({
  WorkspaceShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="workspace-shell">{children}</div>
  ),
}));

// The real next/navigation redirect() throws internally to unwind rendering —
// callers never see it return. Mimic that here so a layout that forgets to
// treat redirect() as terminal (e.g. falls through to the next line instead
// of stopping) fails the test instead of silently reading `session.user`
// off a null session.
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
import WorkspaceLayout from '@/app/workspace/layout';

const children = <div data-testid="child">child content</div>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(redirect).mockImplementation((url: string) => {
    throw new RedirectSignal(url);
  });
});

describe('WorkspaceLayout', () => {
  it('redirects to /sign-in?next=/workspace when there is no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    await expect(WorkspaceLayout({ children })).rejects.toThrow('REDIRECT:/sign-in?next=/workspace');

    expect(getUserRole).not.toHaveBeenCalled();
  });

  it('redirects to /sign-in?next=/workspace when the session has no user email', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: {} } as never);

    await expect(WorkspaceLayout({ children })).rejects.toThrow('REDIRECT:/sign-in?next=/workspace');
  });

  it('redirects to /portal when the resolved role is not a team role', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'u1', email: 'user@example.com' },
    } as never);
    vi.mocked(getUserRole).mockResolvedValue('user');

    await expect(WorkspaceLayout({ children })).rejects.toThrow('REDIRECT:/portal');
  });

  it('redirects to /portal when the role lookup returns null', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'u1', email: 'user@example.com' },
    } as never);
    vi.mocked(getUserRole).mockResolvedValue(null);

    await expect(WorkspaceLayout({ children })).rejects.toThrow('REDIRECT:/portal');
  });

  it('renders WorkspaceShell with the session/role and does not redirect for a team role', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'u1', email: 'staff@example.com' },
    } as never);
    vi.mocked(getUserRole).mockResolvedValue('staff');

    const element = await WorkspaceLayout({ children });

    expect(redirect).not.toHaveBeenCalled();
    expect(element.props).toMatchObject({
      role: 'staff',
      userId: 'u1',
      userEmail: 'staff@example.com',
    });
  });
});

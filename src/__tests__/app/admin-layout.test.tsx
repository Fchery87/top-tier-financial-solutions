import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock('@/lib/admin-auth', () => ({ getUserRole: vi.fn() }));

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
import AdminLayout from '@/app/admin/layout';
import { WorkspaceShell } from '@/components/workspace/WorkspaceShell';

const children = <div data-testid="child">child content</div>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(redirect).mockImplementation((url: string) => {
    throw new RedirectSignal(url);
  });
});

describe('AdminLayout', () => {
  it('redirects to /sign-in?next=/admin when there is no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null as never);

    await expect(AdminLayout({ children })).rejects.toThrow('REDIRECT:/sign-in?next=/admin');

    expect(getUserRole).not.toHaveBeenCalled();
  });

  it('redirects to /sign-in?next=/admin when the session has no user email', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({ user: {} } as never);

    await expect(AdminLayout({ children })).rejects.toThrow('REDIRECT:/sign-in?next=/admin');
  });

  it('redirects to /portal when the resolved role is not a team role', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'u1', email: 'user@example.com' },
    } as never);
    vi.mocked(getUserRole).mockResolvedValue('user');

    await expect(AdminLayout({ children })).rejects.toThrow('REDIRECT:/portal');
  });

  it('redirects to /portal when the role lookup returns null', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'u1', email: 'user@example.com' },
    } as never);
    vi.mocked(getUserRole).mockResolvedValue(null);

    await expect(AdminLayout({ children })).rejects.toThrow('REDIRECT:/portal');
  });

  it('redirects to /workspace when the role is a team role lacking content:write (staff)', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'u1', email: 'staff@example.com' },
    } as never);
    vi.mocked(getUserRole).mockResolvedValue('staff');

    await expect(AdminLayout({ children })).rejects.toThrow('REDIRECT:/workspace');
  });

  it('renders the workspace shell and does not redirect for an admin role', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'u1', email: 'admin@example.com' },
    } as never);
    vi.mocked(getUserRole).mockResolvedValue('admin');

    const element = await AdminLayout({ children });

    expect(redirect).not.toHaveBeenCalled();
    expect(element.type).toBe(WorkspaceShell);
    expect(element.props.role).toBe('admin');
    expect(element.props.children).toBe(children);
  });

  it('renders the workspace shell and does not redirect for a super_admin role', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: 'u1', email: 'super@example.com' },
    } as never);
    vi.mocked(getUserRole).mockResolvedValue('super_admin');

    const element = await AdminLayout({ children });

    expect(redirect).not.toHaveBeenCalled();
    expect(element.type).toBe(WorkspaceShell);
    expect(element.props.role).toBe('super_admin');
    expect(element.props.children).toBe(children);
  });
});

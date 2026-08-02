import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as React from 'react';

vi.mock('@/lib/admin-session', () => ({ requireCapability: vi.fn() }));

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

import { requireCapability } from '@/lib/admin-session';
import { redirect } from 'next/navigation';
import TeamPage from '@/app/admin/team/page';
import { TeamManager } from '@/components/workspace/team/TeamManager';

describe('Admin Team page', () => {
  beforeEach(() => vi.resetAllMocks());

  it('redirects an admin without team:manage to /admin', async () => {
    vi.mocked(requireCapability).mockResolvedValue(null);

    await expect(TeamPage()).rejects.toThrow('REDIRECT:/admin');
  });

  it('renders TeamManager for a team manager', async () => {
    vi.mocked(requireCapability).mockResolvedValue({ id: 'owner-1', email: 'owner@example.com', role: 'super_admin' });

    const page = await TeamPage();
    const children = React.Children.toArray(page.props.children);
    const manager = children.find((child) => React.isValidElement(child) && child.type === TeamManager);

    expect(redirect).not.toHaveBeenCalled();
    expect(manager).toMatchObject({
      type: TeamManager,
      props: { currentUserId: 'owner-1' },
    });
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ usePathname: () => '/workspace' }));

import { AdminProvider } from '@/contexts/AdminContext';
import { AdminSidebar } from '@/components/workspace/AdminSidebar';

describe('AdminSidebar', () => {
  it('does not render Team & Roles for an admin without team:manage', () => {
    render(
      <AdminProvider role="admin" userId="admin-1" userEmail="admin@example.com">
        <AdminSidebar />
      </AdminProvider>,
    );

    expect(screen.queryByRole('link', { name: 'Team & Roles' })).not.toBeInTheDocument();
  });

  it('renders Team & Roles for a super admin', () => {
    render(
      <AdminProvider role="super_admin" userId="owner-1" userEmail="owner@example.com">
        <AdminSidebar />
      </AdminProvider>,
    );

    expect(screen.getByRole('link', { name: 'Team & Roles' })).toHaveAttribute('href', '/admin/team');
  });
});

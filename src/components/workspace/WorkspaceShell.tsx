'use client';

import * as React from 'react';
import { AdminSidebar } from '@/components/workspace/AdminSidebar';
import { AdminTopBar } from '@/components/workspace/AdminTopBar';
import { CommandPalette } from '@/components/workspace/CommandPalette';
import { AscendantMark } from '@/components/brand/AscendantMark';
import { AdminProvider } from '@/contexts/AdminContext';
import type { TeamRole } from '@/lib/capabilities';
import { Menu, X } from 'lucide-react';
import Link from 'next/link';

interface WorkspaceShellProps {
  children: React.ReactNode;
  role: TeamRole;
  userId: string;
  userEmail: string;
}

/**
 * The workspace shell is the product mirror of the marketing site's ink bookends:
 * the whole viewport is an ink "desk" (the sidebar sits directly on it) and
 * the workspace is a raised paper sheet inset with a rounded corner — the
 * case file on the desk. The sheet owns its own scroll region.
 *
 * Authorization has already happened server-side in `src/app/workspace/layout.tsx`
 * before this component ever renders — role/userId/userEmail arrive as props
 * rather than being fetched client-side.
 */
export function WorkspaceShell({ children, role, userId, userEmail }: WorkspaceShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const closeMobileMenu = React.useCallback(() => setMobileMenuOpen(false), []);

  return (
    <AdminProvider role={role} userId={userId} userEmail={userEmail}>
      <div className="admin-shell flex h-dvh flex-col overflow-hidden bg-sidebar md:flex-row">
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileMenuOpen}
          onMobileClose={closeMobileMenu}
        />

        {/* Mobile top bar — sits on the ink desk */}
        <div className="flex h-14 shrink-0 items-center justify-between px-4 md:hidden">
          <Link href="/workspace" className="flex items-center gap-2">
            <AscendantMark className="h-7 w-7" />
            <span className="font-display text-sm font-semibold tracking-tight text-ink-foreground">Top Tier</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-sidebar-muted transition-colors duration-[160ms] ease-[var(--ease-out)] hover:bg-white/[0.06] hover:text-white"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <main className="flex min-h-0 min-w-0 flex-1 flex-col p-1.5 pt-0 md:p-2 md:pl-0">
          {/* The paper sheet */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-ink-border bg-background shadow-[0_16px_40px_-24px_rgb(0_0_0/0.6)]">
            <AdminTopBar />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8">
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
      <CommandPalette />
    </AdminProvider>
  );
}

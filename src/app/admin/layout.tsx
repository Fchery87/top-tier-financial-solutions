'use client';

import * as React from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { CommandPalette } from '@/components/admin/CommandPalette';
import { AscendantMark } from '@/components/brand/AscendantMark';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const closeMobileMenu = React.useCallback(() => setMobileMenuOpen(false), []);

  return (
    <AdminGuard>
      <div className="admin-shell min-h-screen bg-muted/25">
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileMenuOpen}
          onMobileClose={closeMobileMenu}
        />

        {/* Mobile top bar */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4">
          <Link href="/admin" className="flex items-center gap-2">
            <AscendantMark className="w-7 h-7" />
            <span className="text-sm font-display font-semibold tracking-tight text-sidebar-foreground">Top Tier</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-white/5 text-sidebar-muted hover:text-sidebar-foreground transition-colors"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <main
          className={cn(
            "min-h-screen transition-all duration-300",
            "mt-14 md:mt-0",
            sidebarCollapsed ? "md:ml-20" : "md:ml-[264px]"
          )}
        >
          <AdminTopBar />
          <div className="mx-auto max-w-[1680px] p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
      <CommandPalette />
    </AdminGuard>
  );
}

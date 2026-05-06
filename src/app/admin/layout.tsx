'use client';

import * as React from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { CommandPalette } from '@/components/admin/CommandPalette';
import { Menu, X, Hexagon } from 'lucide-react';
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
      <div className="min-h-screen bg-muted/25">
        <AdminSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          mobileOpen={mobileMenuOpen}
          onMobileClose={closeMobileMenu}
        />

        {/* Mobile top bar */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-[hsl(220_24%_7%)] border-b border-white/10 flex items-center justify-between px-4">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <Hexagon className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-sans font-bold text-white">Admin</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
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
          <div className="mx-auto max-w-[1680px] p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
      <CommandPalette />
    </AdminGuard>
  );
}

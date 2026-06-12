'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Bell, Zap, ChevronRight, Menu } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAdminRole } from '@/contexts/AdminContext';
import { cn } from '@/lib/utils';

/** Human labels for admin route segments (fallback: title-case). */
const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Dashboard',
  clients: 'Clients',
  disputes: 'Disputes',
  wizard: 'New Dispute',
  'dispute-templates': 'Letter Templates',
  results: 'Results & Wins',
  compliance: 'Compliance',
  tasks: 'Tasks',
  leads: 'Contact Leads',
  bookings: 'Bookings',
  billing: 'Billing',
  agreements: 'Agreements',
  messages: 'Messages',
  content: 'Pages',
  blog: 'Blog Posts',
  services: 'Services',
  testimonials: 'Testimonials',
  faqs: 'FAQs',
  disclaimers: 'Disclaimers',
  'email-templates': 'Email Templates',
  subscribers: 'Subscribers',
  settings: 'Settings',
  'audit-report': 'Audit Report',
};

function titleCase(segment: string): string {
  return segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface Crumb {
  label: string;
  href: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean); // ['admin', 'clients', '123']
  const crumbs: Crumb[] = [];
  let href = '';
  segments.forEach((segment, i) => {
    href += `/${segment}`;
    // Skip raw dynamic ids (numeric or uuid-ish) — show a generic label instead.
    const isId = /^[0-9]+$/.test(segment) || /^[0-9a-f]{8}-/.test(segment);
    const label = isId ? 'Detail' : SEGMENT_LABELS[segment] ?? titleCase(segment);
    crumbs.push({ label, href: i === 0 ? '/admin' : href });
  });
  return crumbs;
}

interface AdminTopBarProps {
  onOpenMobileMenu?: () => void;
}

export function AdminTopBar({ onOpenMobileMenu }: AdminTopBarProps) {
  const pathname = usePathname();
  const { role } = useAdminRole();
  const crumbs = buildCrumbs(pathname);

  const openPalette = React.useCallback(() => {
    window.dispatchEvent(new Event('open-command-palette'));
  }, []);

  const roleLabel =
    role === 'super_admin' ? 'Owner' : role === 'admin' ? 'Admin' : 'Staff';

  return (
    <header className="sticky top-0 z-30 hidden h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md md:flex lg:px-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <React.Fragment key={crumb.href}>
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
              {isLast ? (
                <span className="truncate font-medium text-foreground">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              )}
            </React.Fragment>
          );
        })}
      </nav>

      {/* Global search — opens the command palette */}
      <button
        type="button"
        onClick={openPalette}
        className={cn(
          'group ml-auto hidden h-9 w-full max-w-xs items-center gap-2 rounded-md border border-border bg-muted/50 px-3 text-sm text-muted-foreground',
          'transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex',
        )}
        aria-label="Search (open command palette)"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search clients, disputes…</span>
        <kbd className="ml-auto inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-1.5 lg:ml-3">
        <button
          type="button"
          onClick={openPalette}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
          aria-label="Search"
        >
          <Search className="h-[1.15rem] w-[1.15rem]" />
        </button>

        <Button variant="secondary" size="sm" asChild className="hidden sm:inline-flex">
          <Link href="/admin/disputes/wizard">
            <Zap className="mr-1.5 h-4 w-4" />
            New Dispute
          </Link>
        </Button>

        <button
          type="button"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-[1.15rem] w-[1.15rem]" />
        </button>

        <ThemeToggle />

        <div className="ml-1 flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">
            TT
          </span>
          <span className="hidden text-xs font-medium text-muted-foreground xl:inline">{roleLabel}</span>
        </div>
      </div>

      {/* Mobile menu trigger (only visible on the md range where sidebar is hidden but topbar shows) */}
      {onOpenMobileMenu && (
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
    </header>
  );
}

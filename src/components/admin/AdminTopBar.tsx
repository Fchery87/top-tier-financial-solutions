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
    <header className="hidden h-12 shrink-0 items-center gap-3 border-b border-border/80 bg-background px-4 md:flex lg:px-5">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <React.Fragment key={crumb.href}>
              {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" strokeWidth={1.75} />}
              {isLast ? (
                <span className="truncate font-medium text-foreground">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="truncate text-muted-foreground transition-colors duration-[120ms] ease-[var(--ease-out)] hover:text-foreground"
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
          'group ml-auto hidden h-8 w-full max-w-[280px] items-center gap-2 rounded-md border border-transparent bg-muted/70 px-2.5 text-[13px] text-muted-foreground',
          'transition-colors duration-[120ms] ease-[var(--ease-out)] hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex',
        )}
        aria-label="Search (open command palette)"
      >
        <Search className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        <span className="truncate">Search clients, disputes…</span>
        <kbd className="ml-auto inline-flex items-center gap-0.5 rounded border border-border bg-background px-1.5 py-px font-mono text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      {/* Actions */}
      <div className="ml-auto flex items-center gap-1 lg:ml-3">
        <button
          type="button"
          onClick={openPalette}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-[120ms] ease-[var(--ease-out)] hover:bg-muted hover:text-foreground lg:hidden"
          aria-label="Search"
        >
          <Search className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <button
          type="button"
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors duration-[120ms] ease-[var(--ease-out)] hover:bg-muted hover:text-foreground"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" strokeWidth={1.75} />
        </button>

        <ThemeToggle />

        <div className="mx-1.5 hidden h-4 w-px bg-border sm:block" aria-hidden />

        <Button variant="primary" size="sm" asChild className="hidden sm:inline-flex">
          <Link href="/admin/disputes/wizard">
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            New Dispute
          </Link>
        </Button>

        <div className="ml-1.5 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted font-mono text-[10px] font-semibold text-foreground">
            TT
          </span>
          <span className="hidden font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground xl:inline">
            {roleLabel}
          </span>
        </div>
      </div>

      {/* Mobile menu trigger (only visible on the md range where sidebar is hidden but topbar shows) */}
      {onOpenMobileMenu && (
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}
    </header>
  );
}

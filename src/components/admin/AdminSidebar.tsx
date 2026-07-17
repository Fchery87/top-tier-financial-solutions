'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  MessageSquareQuote,
  HelpCircle,
  Scale,
  Users,
  Calendar,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  Mail,
  Briefcase,
  UserCheck,
  CheckSquare,
  Wand2,
  Library,
  FileSignature,
  MessageCircle,
  CreditCard,
  ShieldCheck,
  Trophy,
  Settings,
  MailOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AscendantMark } from '@/components/brand/AscendantMark';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  /** Match nested routes too (default true for non-root items). */
  exact?: boolean;
}

interface NavSection {
  id: string;
  name: string;
  items: NavItem[];
}

const dashboardLink: NavItem = {
  name: 'Dashboard',
  href: '/admin',
  icon: LayoutDashboard,
  exact: true,
};

const navSections: NavSection[] = [
  {
    id: 'case-management',
    name: 'Case Management',
    items: [
      { name: 'Clients', href: '/admin/clients', icon: UserCheck },
      { name: 'Agreements', href: '/admin/agreements', icon: FileSignature },
      { name: 'Messages', href: '/admin/messages', icon: MessageCircle },
      { name: 'Billing', href: '/admin/billing', icon: CreditCard },
    ],
  },
  {
    id: 'disputes',
    name: 'Disputes',
    items: [
      { name: 'All Disputes', href: '/admin/disputes', icon: Scale },
      { name: 'Results & Wins', href: '/admin/results', icon: Trophy },
      { name: 'Dispute Wizard', href: '/admin/disputes/wizard', icon: Wand2 },
      { name: 'Letter Templates', href: '/admin/dispute-templates', icon: Library },
      { name: 'Compliance', href: '/admin/compliance', icon: ShieldCheck },
    ],
  },
  {
    id: 'operations',
    name: 'Operations',
    items: [
      { name: 'Tasks', href: '/admin/tasks', icon: CheckSquare },
      { name: 'Contact Leads', href: '/admin/leads', icon: Users },
      { name: 'Bookings', href: '/admin/bookings', icon: Calendar },
    ],
  },
  {
    id: 'content',
    name: 'Content',
    items: [
      { name: 'Pages', href: '/admin/content', icon: FileText },
      { name: 'Blog Posts', href: '/admin/blog', icon: BookOpen },
      { name: 'Services', href: '/admin/services', icon: Briefcase },
      { name: 'Testimonials', href: '/admin/testimonials', icon: MessageSquareQuote },
      { name: 'FAQs', href: '/admin/faqs', icon: HelpCircle },
      { name: 'Disclaimers', href: '/admin/disclaimers', icon: Scale },
      { name: 'Email Templates', href: '/admin/email-templates', icon: MailOpen },
      { name: 'Subscribers', href: '/admin/subscribers', icon: Mail },
    ],
  },
];

interface AdminSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function NavRow({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex h-8 items-center gap-2.5 rounded-md text-[13px] transition-colors duration-[120ms] ease-[var(--ease-out)]',
        collapsed ? 'justify-center px-0' : 'px-2.5',
        active
          ? 'bg-white/[0.08] font-medium text-white'
          : 'text-sidebar-foreground hover:bg-white/[0.04] hover:text-white',
      )}
    >
      <item.icon
        className={cn('h-[15px] w-[15px] shrink-0', active ? 'text-sidebar-active' : 'text-current opacity-80')}
        strokeWidth={1.75}
      />
      {!collapsed && <span className="truncate">{item.name}</span>}
      {collapsed && (
        <span className="pointer-events-none absolute left-full z-50 ml-3 whitespace-nowrap rounded-md border border-ink-border bg-ink-raised px-2 py-1 text-xs text-ink-foreground opacity-0 shadow-lg transition-opacity duration-[120ms] group-hover:opacity-100">
          {item.name}
        </span>
      )}
    </Link>
  );
}

/**
 * Flat, single-level nav on the ink desk. Sections are quiet mono labels —
 * no accordions, no chevrons — so every destination is one glance and one
 * click away. Active rows get a raised ink fill with a brass icon.
 */
export function AdminSidebar({ collapsed = false, onToggle, mobileOpen = false, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname();

  React.useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const isItemActive = (item: NavItem) => {
    if (item.exact) return pathname === item.href;
    // "All Disputes" should not light up while the wizard is open.
    const nestedMatch = navSections
      .flatMap((s) => s.items)
      .some((other) => other.href !== item.href && other.href.startsWith(item.href) && pathname.startsWith(other.href));
    return pathname === item.href || (!nestedMatch && pathname.startsWith(`${item.href}/`));
  };

  const handleNavClick = () => {
    if (mobileOpen && onMobileClose) onMobileClose();
  };

  const renderNav = (isCollapsed: boolean) => (
    <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-2">
      <NavRow item={dashboardLink} active={pathname === '/admin'} collapsed={isCollapsed} onNavigate={handleNavClick} />

      {navSections.map((section) => (
        <div key={section.id}>
          {isCollapsed ? (
            <div className="py-2.5">
              <div className="mx-auto h-px w-6 bg-sidebar-border" />
            </div>
          ) : (
            <p className="px-2.5 pb-1.5 pt-5 font-mono text-[9px] font-medium uppercase tracking-[0.22em] text-sidebar-muted">
              {section.name}
            </p>
          )}
          <div className="space-y-px">
            {section.items.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                active={isItemActive(item)}
                collapsed={isCollapsed}
                onNavigate={handleNavClick}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const renderFooter = (isCollapsed: boolean) => (
    <div className="shrink-0 space-y-px border-t border-sidebar-border px-3 py-3">
      <NavRow
        item={{ name: 'Settings', href: '/admin/settings', icon: Settings }}
        active={pathname.startsWith('/admin/settings')}
        collapsed={isCollapsed}
        onNavigate={handleNavClick}
      />
      <NavRow
        item={{ name: 'Back to Site', href: '/', icon: LogOut, exact: true }}
        active={false}
        collapsed={isCollapsed}
        onNavigate={handleNavClick}
      />
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — a flex child on the ink desk, CSS width transition */}
      <aside
        className={cn(
          'hidden h-full shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-[var(--ease-out)] md:flex',
          collapsed ? 'w-[60px]' : 'w-[232px]',
        )}
      >
        <div className={cn('flex h-14 shrink-0 items-center', collapsed ? 'justify-center px-0' : 'justify-between pl-4 pr-2')}>
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
            <AscendantMark className="h-7 w-7 shrink-0" />
            {!collapsed && (
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-display text-[13px] font-semibold leading-none tracking-tight text-white">
                  Top Tier
                </span>
                <span className="mt-1 truncate font-mono text-[8px] font-medium uppercase tracking-[0.24em] text-sidebar-active">
                  Operations
                </span>
              </span>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={onToggle}
              className="rounded-md p-1.5 text-sidebar-muted transition-colors duration-[120ms] ease-[var(--ease-out)] hover:bg-white/[0.06] hover:text-white"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
        {collapsed && (
          <div className="flex shrink-0 justify-center pb-1">
            <button
              onClick={onToggle}
              className="rounded-md p-1.5 text-sidebar-muted transition-colors duration-[120ms] ease-[var(--ease-out)] hover:bg-white/[0.06] hover:text-white"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        )}
        {renderNav(collapsed)}
        {renderFooter(collapsed)}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={onMobileClose}
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="fixed left-0 top-0 z-50 flex h-dvh w-[260px] flex-col border-r border-sidebar-border bg-sidebar md:hidden"
            >
              <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
                <Link href="/admin" onClick={handleNavClick} className="flex items-center gap-2.5">
                  <AscendantMark className="h-7 w-7 shrink-0" />
                  <span className="font-display text-sm font-semibold tracking-tight text-white">Top Tier</span>
                </Link>
              </div>
              {renderNav(false)}
              {renderFooter(false)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

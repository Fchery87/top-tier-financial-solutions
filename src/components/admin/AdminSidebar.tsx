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
  ChevronLeft,
  ChevronRight,
  ChevronDown,
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
  FolderKanban,
  Megaphone,
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
}

interface NavSection {
  id: string;
  name: string;
  icon: React.ElementType;
  items: NavItem[];
}

const dashboardLink: NavItem = { 
  name: 'Dashboard', 
  href: '/admin', 
  icon: LayoutDashboard 
};

const navSections: NavSection[] = [
  {
    id: 'case-management',
    name: 'Case Management',
    icon: FolderKanban,
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
    icon: Scale,
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
    icon: CheckSquare,
    items: [
      { name: 'Tasks', href: '/admin/tasks', icon: CheckSquare },
      { name: 'Contact Leads', href: '/admin/leads', icon: Users },
      { name: 'Bookings', href: '/admin/bookings', icon: Calendar },
    ],
  },
  {
    id: 'content',
    name: 'Content',
    icon: Megaphone,
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

export function AdminSidebar({ collapsed = false, onToggle, mobileOpen = false, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(() => {
    const active = new Set<string>();
    navSections.forEach(section => {
      if (section.items.some(item => 
        pathname === item.href || 
        (item.href !== '/admin' && pathname.startsWith(item.href))
      )) {
        active.add(section.id);
      }
    });
    if (active.size === 0) {
      active.add('case-management');
      active.add('disputes');
    }
    return active;
  });

  React.useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const isItemActive = (href: string) => {
    return pathname === href || (href !== '/admin' && pathname.startsWith(href));
  };

  const isSectionActive = (section: NavSection) => {
    return section.items.some(item => isItemActive(item.href));
  };

  const handleNavClick = () => {
    if (mobileOpen && onMobileClose) {
      onMobileClose();
    }
  };

  const sidebarContent = (
    <>
      {/* Logo - hidden on mobile (shown in top bar instead) */}
      <div className="hidden md:flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        <Link href="/admin" className="flex items-center gap-3">
          <AscendantMark className="w-9 h-9 flex-shrink-0" />
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="font-display text-lg font-semibold tracking-tight text-sidebar-foreground"
            >
              Top Tier
            </motion.span>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="p-2 rounded-md hover:bg-accent text-sidebar-muted hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile logo */}
      <div className="md:hidden h-14 flex items-center px-4 border-b border-sidebar-border">
        <Link href="/admin" onClick={handleNavClick} className="flex items-center gap-2">
          <AscendantMark className="w-8 h-8 flex-shrink-0" />
          <span className="font-display text-base font-semibold tracking-tight text-sidebar-foreground">Top Tier</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {/* Dashboard Link */}
        <Link
          href={dashboardLink.href}
          onClick={handleNavClick}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors duration-150 group relative",
            pathname === dashboardLink.href 
              ? "bg-accent text-foreground font-medium"
              : "text-sidebar-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <dashboardLink.icon className={cn(
            "w-5 h-5 flex-shrink-0",
            pathname === dashboardLink.href ? "text-secondary" : "text-current"
          )} />
          {(!collapsed || mobileOpen) && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm font-medium"
            >
              {dashboardLink.name}
            </motion.span>
          )}
          {collapsed && !mobileOpen && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-foreground rounded-md text-background text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              {dashboardLink.name}
            </div>
          )}
        </Link>

        {/* Sections */}
        <div className="pt-2 space-y-1">
          {navSections.map((section) => {
            const isExpanded = expandedSections.has(section.id);
            const sectionActive = isSectionActive(section);

            return (
              <div key={section.id}>
                {/* Section Header */}
                {(!collapsed || mobileOpen) ? (
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={cn(
                       "w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors duration-150",
                      sectionActive
                        ? "text-sidebar-active"
                        : "text-sidebar-muted hover:text-sidebar-foreground/80"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <section.icon className="w-4 h-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">
                        {section.name}
                      </span>
                    </div>
                    <ChevronDown className={cn(
                      "w-4 h-4 transition-transform duration-200",
                      isExpanded ? "rotate-180" : ""
                    )} />
                  </button>
                ) : (
                  <div className="py-2">
                    <div className="w-8 h-px bg-sidebar-border mx-auto" />
                  </div>
                )}

                {/* Section Items */}
                <AnimatePresence initial={false}>
                  {(isExpanded || collapsed) && (!collapsed || mobileOpen || collapsed) && (
                    <motion.div
                      initial={collapsed && !mobileOpen ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={collapsed && !mobileOpen ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn("overflow-hidden", !collapsed && "pl-2")}
                    >
                      {section.items.map((item) => {
                        const isActive = isItemActive(item.href);

                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={handleNavClick}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors duration-150 group relative",
                              isActive 
                                ? "bg-accent text-foreground font-medium"
                                : "text-sidebar-foreground hover:bg-accent hover:text-foreground"
                            )}
                          >
                            <item.icon className={cn(
                              "w-4 h-4 flex-shrink-0",
                              isActive ? "text-secondary" : "text-current"
                            )} />
                            {(!collapsed || mobileOpen) && (
                              <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-sm"
                              >
                                {item.name}
                              </motion.span>
                            )}
                            {collapsed && !mobileOpen && (
                              <div className="absolute left-full ml-2 px-2 py-1 bg-foreground rounded-md text-background text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                {item.name}
                              </div>
                            )}
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border space-y-1">
        <Link
          href="/admin/settings"
          onClick={handleNavClick}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors duration-150 group relative",
            pathname === '/admin/settings'
              ? "bg-accent text-foreground font-medium"
              : "text-sidebar-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Settings className={cn(
            "w-5 h-5 flex-shrink-0",
            pathname === '/admin/settings' ? "text-secondary" : "text-current"
          )} />
          {(!collapsed || mobileOpen) && (
            <span className="text-sm font-medium">Settings</span>
          )}
          {collapsed && !mobileOpen && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-foreground rounded-md text-background text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Settings
            </div>
          )}
        </Link>
        <Link
          href="/"
          onClick={handleNavClick}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sidebar-foreground hover:bg-accent hover:text-foreground transition-colors duration-150 group relative"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {(!collapsed || mobileOpen) && (
            <span className="text-sm font-medium">Back to Site</span>
          )}
          {collapsed && !mobileOpen && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-foreground rounded-md text-background text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Back to Site
            </div>
          )}
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 264 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="hidden md:flex fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border flex-col"
      >
        {sidebarContent}
      </motion.aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={onMobileClose}
            />
            <motion.aside
              initial={{ x: -264 }}
              animate={{ x: 0 }}
              exit={{ x: -264 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="md:hidden fixed left-0 top-0 z-50 h-screen w-[264px] bg-sidebar border-r border-sidebar-border flex flex-col"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

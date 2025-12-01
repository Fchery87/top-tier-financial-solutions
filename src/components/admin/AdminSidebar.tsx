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
  Sparkles,
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
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
      { name: 'Subscribers', href: '/admin/subscribers', icon: Mail },
    ],
  },
];

interface AdminSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function AdminSidebar({ collapsed = false, onToggle }: AdminSidebarProps) {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(() => {
    // Default: expand sections containing active route
    const active = new Set<string>();
    navSections.forEach(section => {
      if (section.items.some(item => 
        pathname === item.href || 
        (item.href !== '/admin' && pathname.startsWith(item.href))
      )) {
        active.add(section.id);
      }
    });
    // If no section is active, expand first two
    if (active.size === 0) {
      active.add('case-management');
      active.add('disputes');
    }
    return active;
  });

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

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="fixed left-0 top-0 z-40 h-screen bg-primary border-r border-border/10 flex flex-col"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
        <Link href="/admin" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-lg font-serif font-bold text-white"
            >
              Admin
            </motion.span>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {/* Dashboard Link */}
        <Link
          href={dashboardLink.href}
          className={cn(
            "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative",
            pathname === dashboardLink.href 
              ? "bg-secondary text-primary" 
              : "text-white/70 hover:bg-white/10 hover:text-white"
          )}
        >
          <dashboardLink.icon className={cn(
            "w-5 h-5 flex-shrink-0",
            pathname === dashboardLink.href ? "text-primary" : "text-current"
          )} />
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm font-medium"
            >
              {dashboardLink.name}
            </motion.span>
          )}
          {collapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-primary rounded-md text-white text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
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
                {!collapsed ? (
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200",
                      sectionActive 
                        ? "text-secondary" 
                        : "text-white/50 hover:text-white/70"
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
                    <div className="w-8 h-px bg-white/10 mx-auto" />
                  </div>
                )}

                {/* Section Items */}
                <AnimatePresence initial={false}>
                  {(isExpanded || collapsed) && (
                    <motion.div
                      initial={collapsed ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={collapsed ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className={cn("overflow-hidden", !collapsed && "pl-2")}
                    >
                      {section.items.map((item) => {
                        const isActive = isItemActive(item.href);

                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative",
                              isActive 
                                ? "bg-secondary text-primary" 
                                : "text-white/70 hover:bg-white/10 hover:text-white"
                            )}
                          >
                            <item.icon className={cn(
                              "w-4 h-4 flex-shrink-0",
                              isActive ? "text-primary" : "text-current"
                            )} />
                            {!collapsed && (
                              <motion.span
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-sm"
                              >
                                {item.name}
                              </motion.span>
                            )}
                            {collapsed && (
                              <div className="absolute left-full ml-2 px-2 py-1 bg-primary rounded-md text-white text-sm whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
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
      <div className="p-3 border-t border-white/10">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && (
            <span className="text-sm font-medium">Back to Site</span>
          )}
        </Link>
      </div>
    </motion.aside>
  );
}

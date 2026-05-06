'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, FileText, FileSignature } from 'lucide-react';

const tabs = [
  { href: '/portal', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portal/audit-report', label: 'Audit Report', icon: FileText },
  { href: '/portal/agreement', label: 'Agreement', icon: FileSignature },
];

export default function PortalNav() {
  const pathname = usePathname();

  return (
    <nav className="border-y border-border/70 bg-background/80 px-4 md:px-6">
      <div className="container mx-auto flex items-center gap-1 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              isActive
                ? 'border-secondary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </Link>
        );
      })}
      </div>
    </nav>
  );
}

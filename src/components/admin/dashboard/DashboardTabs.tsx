'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'overview', name: 'Overview' },
  { id: 'pipeline', name: 'Pipeline' },
  { id: 'analytics', name: 'Analytics' },
  { id: 'operations', name: 'Operations' },
] as const;

export type DashboardTab = (typeof tabs)[number]['id'];

interface DashboardTabsProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  /** Right-aligned slot on the tab row (e.g. a density toggle). */
  actions?: React.ReactNode;
}

export function DashboardTabs({ activeTab, onTabChange, actions }: DashboardTabsProps) {
  return (
    <div className="flex items-center justify-between border-b border-border">
      <div className="flex gap-5 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative whitespace-nowrap pb-2.5 pt-1 text-[13px] font-medium transition-colors duration-[120ms] ease-[var(--ease-out)]',
              activeTab === tab.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.name}
            {activeTab === tab.id && (
              <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-secondary" />
            )}
          </button>
        ))}
      </div>
      {actions && <div className="ml-4 hidden shrink-0 items-center pb-1.5 md:flex">{actions}</div>}
    </div>
  );
}

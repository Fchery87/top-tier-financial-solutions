'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { LayoutDashboard, GitBranch, BarChart3, Settings2 } from 'lucide-react';

const tabs = [
  { id: 'overview', name: 'Overview', icon: LayoutDashboard },
  { id: 'pipeline', name: 'Pipeline', icon: GitBranch },
  { id: 'analytics', name: 'Analytics', icon: BarChart3 },
  { id: 'operations', name: 'Operations', icon: Settings2 },
] as const;

export type DashboardTab = (typeof tabs)[number]['id'];

interface DashboardTabsProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}

export function DashboardTabs({ activeTab, onTabChange }: DashboardTabsProps) {
  return (
    <div className="border-b border-border">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'relative flex items-center gap-2 px-3.5 py-3 text-sm font-medium transition-colors duration-[160ms] ease-[var(--ease-out)] whitespace-nowrap',
              activeTab === tab.id
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className={cn('h-4 w-4', activeTab === tab.id ? 'text-secondary' : 'text-current')} strokeWidth={1.75} />
            <span>{tab.name}</span>
            {activeTab === tab.id && (
              <div className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-secondary" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

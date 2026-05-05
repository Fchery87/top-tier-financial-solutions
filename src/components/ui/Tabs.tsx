'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TabsProps {
  tabs: { id: string; label: string; icon?: React.ElementType }[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <div className={cn("border-b border-border/50", className)}>
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap",
                isActive
                  ? "text-secondary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon && <tab.icon className="w-4 h-4" />}
              <span>{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface TabsContentProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  children: React.ReactNode;
}

export function TabsContent({ tabs, activeTab, children }: TabsContentProps) {
  const tabIndex = tabs.findIndex((t) => t.id === activeTab);
  const childArray = React.Children.toArray(children);

  return (
    <div>
      {childArray.map((child, index) => (
        <div key={tabs[index]?.id || index} className={index === tabIndex ? 'block' : 'hidden'}>
          {child}
        </div>
      ))}
    </div>
  );
}

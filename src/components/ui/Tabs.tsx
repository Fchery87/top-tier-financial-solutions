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
    <div className={cn("border-b border-border", className)}>
      <div className="flex gap-5 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex items-center gap-1.5 whitespace-nowrap pb-2.5 pt-1 text-[13px] font-medium transition-colors duration-[120ms] ease-[var(--ease-out)]",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon && <tab.icon className={cn("h-3.5 w-3.5", isActive ? "text-secondary" : "text-current")} strokeWidth={1.75} />}
              <span>{tab.label}</span>
              {isActive && (
                <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-secondary" />
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

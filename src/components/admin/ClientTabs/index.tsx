'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  LayoutGrid, 
  FileText, 
  Scale, 
  CheckSquare, 
  MessageSquare 
} from 'lucide-react';

export type ClientTab = 'overview' | 'reports' | 'disputes' | 'tasks' | 'notes';

interface TabConfig {
  id: ClientTab;
  name: string;
  icon: React.ElementType;
}

const tabs: TabConfig[] = [
  { id: 'overview', name: 'Overview', icon: LayoutGrid },
  { id: 'reports', name: 'Credit Reports', icon: FileText },
  { id: 'disputes', name: 'Disputes', icon: Scale },
  { id: 'tasks', name: 'Tasks', icon: CheckSquare },
  { id: 'notes', name: 'Notes', icon: MessageSquare },
];

interface ClientTabsProps {
  activeTab: ClientTab;
  onTabChange: (tab: ClientTab) => void;
  counts?: {
    reports?: number;
    disputes?: number;
    tasks?: number;
    notes?: number;
  };
}

export function ClientTabs({ activeTab, onTabChange, counts }: ClientTabsProps) {
  return (
    <div className="border-b border-border/50">
      <div className="flex gap-1 overflow-x-auto pb-px">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = counts?.[tab.id as keyof typeof counts];
          
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
              <tab.icon className="w-4 h-4" />
              <span>{tab.name}</span>
              {count !== undefined && count > 0 && (
                <span className={cn(
                  "px-1.5 py-0.5 text-xs rounded-full",
                  isActive 
                    ? "bg-secondary/20 text-secondary" 
                    : "bg-muted text-muted-foreground"
                )}>
                  {count}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { tabs };

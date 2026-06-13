'use client';

import { CheckSquare, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { StatGrid, type StatItem } from '@/components/admin/StatGrid';

interface TaskStatsCardsProps {
  totalItems: number;
  todoCount: number;
  inProgressCount: number;
  overdueCount: number;
}

export function TaskStatsCards({ totalItems, todoCount, inProgressCount, overdueCount }: TaskStatsCardsProps) {
  const items: StatItem[] = [
    { label: 'Total Tasks', value: totalItems, icon: CheckSquare },
    { label: 'To Do', value: todoCount, icon: Clock, tone: 'warning' },
    { label: 'In Progress', value: inProgressCount, icon: RefreshCw, tone: 'brass' },
    { label: 'Overdue', value: overdueCount, icon: AlertCircle, tone: 'down' },
  ];

  return <StatGrid items={items} columns={4} />;
}

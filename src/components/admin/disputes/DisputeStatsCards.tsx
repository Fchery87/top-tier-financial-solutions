'use client';

import { Scale, Send, CheckCircle2, AlertTriangle, RotateCcw } from 'lucide-react';
import { StatGrid, type StatItem } from '@/components/admin/StatGrid';

interface DisputeStats {
  total: number;
  sent: number;
  resolved: number;
  overdue: number;
  deleted: number;
  verified: number;
}

interface DisputeStatsCardsProps {
  stats: DisputeStats;
  showOverdueOnly: boolean;
  onOverdueToggle: () => void;
}

export function DisputeStatsCards({ stats, showOverdueOnly, onOverdueToggle }: DisputeStatsCardsProps) {
  const items: StatItem[] = [
    { label: 'Total', value: stats.total, icon: Scale },
    { label: 'Sent', value: stats.sent, icon: Send, tone: 'brass' },
    {
      label: 'Overdue',
      value: stats.overdue,
      icon: AlertTriangle,
      tone: 'down',
      onClick: onOverdueToggle,
      active: showOverdueOnly,
    },
    { label: 'Deleted', value: stats.deleted, icon: CheckCircle2, tone: 'up' },
    { label: 'Verified', value: stats.verified, icon: RotateCcw, tone: 'warning' },
    { label: 'Resolved', value: stats.resolved, icon: CheckCircle2 },
  ];

  return <StatGrid items={items} columns={6} />;
}

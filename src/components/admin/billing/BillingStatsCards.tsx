'use client';

import { FileText, DollarSign, Clock } from 'lucide-react';
import { StatGrid, type StatItem } from '@/components/admin/StatGrid';
import { formatCurrency } from '@/lib/format';

interface BillingStats {
  total_invoices: number;
  total_revenue: number;
  pending_amount: number;
}

interface BillingStatsCardsProps {
  stats: BillingStats | null;
}

export function BillingStatsCards({ stats }: BillingStatsCardsProps) {
  if (!stats) return null;

  const items: StatItem[] = [
    { label: 'Total Invoices', value: stats.total_invoices, icon: FileText },
    { label: 'Total Revenue', value: formatCurrency(stats.total_revenue), icon: DollarSign, tone: 'up' },
    { label: 'Pending Amount', value: formatCurrency(stats.pending_amount), icon: Clock, tone: 'warning' },
  ];

  return <StatGrid items={items} columns={3} />;
}

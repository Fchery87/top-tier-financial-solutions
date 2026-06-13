'use client';

import { FileSignature, Clock, DollarSign, MessageCircle } from 'lucide-react';
import { StatGrid, type StatItem } from '@/components/admin/StatGrid';

interface ComplianceStats {
  clients_with_agreements: number;
  pending_agreements: number;
  agreements_in_cancellation: number;
  total_invoices: number;
  invoices_without_services: number;
  open_message_threads: number;
}

interface ComplianceStatsGridProps {
  stats: ComplianceStats | null;
}

export function ComplianceStatsGrid({ stats }: ComplianceStatsGridProps) {
  if (!stats) return null;

  const items: StatItem[] = [
    {
      label: 'Agreements',
      value: stats.clients_with_agreements,
      icon: FileSignature,
      tone: 'brass',
      hint: `Signed · ${stats.pending_agreements} pending`,
    },
    {
      label: 'Cancellation Window',
      value: stats.agreements_in_cancellation,
      icon: Clock,
      tone: 'warning',
      hint: 'Within 3-day CROA period',
    },
    {
      label: 'Invoice Compliance',
      value: `${stats.total_invoices - stats.invoices_without_services}/${stats.total_invoices}`,
      icon: DollarSign,
      tone: 'up',
      hint: 'With documented services',
    },
    {
      label: 'Open Threads',
      value: stats.open_message_threads,
      icon: MessageCircle,
      tone: 'brass',
      hint: 'Client messages',
    },
  ];

  return <StatGrid items={items} columns={4} />;
}

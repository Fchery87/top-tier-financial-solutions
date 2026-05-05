'use client';

import { motion } from 'framer-motion';
import { FileSignature, Clock, DollarSign, MessageCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
    >
      <Card className="bg-card border border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <FileSignature className="w-5 h-5 text-blue-500" />
            </div>
            <p className="text-sm text-muted-foreground">Agreements</p>
          </div>
          <p className="text-2xl font-bold">{stats.clients_with_agreements}</p>
          <p className="text-xs text-muted-foreground">
            Signed | {stats.pending_agreements} pending
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-sm text-muted-foreground">Cancellation Window</p>
          </div>
          <p className="text-2xl font-bold">{stats.agreements_in_cancellation}</p>
          <p className="text-xs text-muted-foreground">
            Within 3-day CROA period
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-sm text-muted-foreground">Invoice Compliance</p>
          </div>
          <p className="text-2xl font-bold">
            {stats.total_invoices - stats.invoices_without_services}
            <span className="text-sm text-muted-foreground font-normal">/{stats.total_invoices}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            With documented services
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card border border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <MessageCircle className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-sm text-muted-foreground">Open Threads</p>
          </div>
          <p className="text-2xl font-bold">{stats.open_message_threads}</p>
          <p className="text-xs text-muted-foreground">
            Client messages
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

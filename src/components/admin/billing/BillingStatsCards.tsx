'use client';

import { motion } from 'framer-motion';
import { FileText, DollarSign, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="grid grid-cols-1 sm:grid-cols-3 gap-4"
    >
      <Card className="bg-card border border-border">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted/60">
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-display text-3xl font-light tabular-nums">{stats.total_invoices}</p>
            <p className="text-sm text-muted-foreground">Total Invoices</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card border border-border">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-success/20 bg-success/10">
            <DollarSign className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="font-display text-3xl font-light tabular-nums">{formatCurrency(stats.total_revenue)}</p>
            <p className="text-sm text-muted-foreground">Total Revenue</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card border border-border">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-warning/20 bg-warning/10">
            <Clock className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="font-display text-3xl font-light tabular-nums">{formatCurrency(stats.pending_amount)}</p>
            <p className="text-sm text-muted-foreground">Pending Amount</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

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
          <div className="p-3 rounded-xl bg-blue-500/10">
            <FileText className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.total_invoices}</p>
            <p className="text-sm text-muted-foreground">Total Invoices</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card border border-border">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-green-500/10">
            <DollarSign className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{formatCurrency(stats.total_revenue)}</p>
            <p className="text-sm text-muted-foreground">Total Revenue</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card border border-border">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-yellow-500/10">
            <Clock className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <p className="text-2xl font-bold">{formatCurrency(stats.pending_amount)}</p>
            <p className="text-sm text-muted-foreground">Pending Amount</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

'use client';

import { motion } from 'framer-motion';
import {
  Scale,
  Send,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

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
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4"
    >
      <Card className="bg-card border border-border">
        <CardContent className="p-4 text-center">
          <Scale className="w-5 h-5 mx-auto mb-2 text-purple-500" />
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent>
      </Card>
      <Card className="bg-card border border-border">
        <CardContent className="p-4 text-center">
          <Send className="w-5 h-5 mx-auto mb-2 text-blue-500" />
          <p className="text-2xl font-bold">{stats.sent}</p>
          <p className="text-xs text-muted-foreground">Sent</p>
        </CardContent>
      </Card>
      <Card
        className={`bg-card border border-border cursor-pointer transition-all ${showOverdueOnly ? 'ring-2 ring-red-500' : ''}`}
        onClick={onOverdueToggle}
      >
        <CardContent className="p-4 text-center">
          <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-red-500" />
          <p className="text-2xl font-bold text-red-500">{stats.overdue}</p>
          <p className="text-xs text-muted-foreground">Overdue</p>
        </CardContent>
      </Card>
      <Card className="bg-card border border-border">
        <CardContent className="p-4 text-center">
          <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-green-500" />
          <p className="text-2xl font-bold text-green-500">{stats.deleted}</p>
          <p className="text-xs text-muted-foreground">Deleted</p>
        </CardContent>
      </Card>
      <Card className="bg-card border border-border">
        <CardContent className="p-4 text-center">
          <RotateCcw className="w-5 h-5 mx-auto mb-2 text-yellow-500" />
          <p className="text-2xl font-bold text-yellow-500">{stats.verified}</p>
          <p className="text-xs text-muted-foreground">Verified</p>
        </CardContent>
      </Card>
      <Card className="bg-card border border-border">
        <CardContent className="p-4 text-center">
          <CheckCircle2 className="w-5 h-5 mx-auto mb-2 text-emerald-500" />
          <p className="text-2xl font-bold">{stats.resolved}</p>
          <p className="text-xs text-muted-foreground">Resolved</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

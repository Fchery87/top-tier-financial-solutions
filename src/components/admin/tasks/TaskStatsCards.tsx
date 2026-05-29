'use client';

import { motion } from 'framer-motion';
import { CheckSquare, Clock, RefreshCw, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';

interface TaskStatsCardsProps {
  totalItems: number;
  todoCount: number;
  inProgressCount: number;
  overdueCount: number;
}

export function TaskStatsCards({ totalItems, todoCount, inProgressCount, overdueCount }: TaskStatsCardsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="grid grid-cols-1 sm:grid-cols-4 gap-4"
    >
      <Card className="bg-card border border-border">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-secondary/10">
            <CheckSquare className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{totalItems}</p>
            <p className="text-sm text-muted-foreground">Total Tasks</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card border border-border">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-warning/10">
            <Clock className="w-6 h-6 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold">{todoCount}</p>
            <p className="text-sm text-muted-foreground">To Do</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card border border-border">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-secondary/10">
            <RefreshCw className="w-6 h-6 text-secondary" />
          </div>
          <div>
            <p className="text-2xl font-bold">{inProgressCount}</p>
            <p className="text-sm text-muted-foreground">In Progress</p>
          </div>
        </CardContent>
      </Card>
      <Card className="bg-card border border-border">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-destructive/10">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold">{overdueCount}</p>
            <p className="text-sm text-muted-foreground">Overdue</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

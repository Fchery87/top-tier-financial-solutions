'use client';

import { motion } from 'framer-motion';
import { Filter, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface StatusOption {
  value: string;
  label: string;
}

interface BureauOption {
  value: string;
  label: string;
}

interface DisputeFiltersProps {
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  selectedBureau: string;
  onBureauChange: (value: string) => void;
  showAwaitingOnly: boolean;
  onAwaitingToggle: () => void;
  showOverdueOnly: boolean;
  onOverdueToggle: () => void;
  onClearFilters: () => void;
  onSaveAsDefault: () => void;
  statusOptions: StatusOption[];
  bureauOptions: BureauOption[];
}

export function DisputeFilters({
  selectedStatus,
  onStatusChange,
  selectedBureau,
  onBureauChange,
  showAwaitingOnly,
  onAwaitingToggle,
  showOverdueOnly,
  onOverdueToggle,
  onClearFilters,
  onSaveAsDefault,
  statusOptions,
  bureauOptions,
}: DisputeFiltersProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="flex flex-wrap items-center gap-3"
    >
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
      <select
        value={selectedBureau}
        onChange={(e) => onBureauChange(e.target.value)}
        className="h-9 px-3 rounded-md border border-input bg-background text-sm"
      >
        {bureauOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <Button
        variant={showAwaitingOnly ? 'secondary' : 'outline'}
        size="sm"
        onClick={onAwaitingToggle}
      >
        <Clock className="w-4 h-4 mr-1" />
        Awaiting Response
      </Button>
      <Button
        variant={showOverdueOnly ? 'destructive' : 'outline'}
        size="sm"
        onClick={onOverdueToggle}
      >
        <AlertTriangle className="w-4 h-4 mr-1" />
        Overdue Only
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onSaveAsDefault}
      >
        Save as Default
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearFilters}
      >
        Clear Filters
      </Button>
    </motion.div>
  );
}

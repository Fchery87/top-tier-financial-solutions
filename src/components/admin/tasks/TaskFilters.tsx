'use client';

import { Filter } from 'lucide-react';
import { Input } from '@/components/ui/Input';

interface Option {
  value: string;
  label: string;
}

interface TaskFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  selectedPriority: string;
  onPriorityChange: (value: string) => void;
  statusOptions: Option[];
  priorityOptions: Option[];
}

export function TaskFilters({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedPriority,
  onPriorityChange,
  statusOptions,
  priorityOptions,
}: TaskFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="relative flex-1 max-w-sm">
        <Input
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
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
        <select
          value={selectedPriority}
          onChange={(e) => onPriorityChange(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm"
        >
          {priorityOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

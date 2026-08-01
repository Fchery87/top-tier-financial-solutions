'use client';

import { Filter, Search } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface StatusOption {
  value: string;
  label: string;
}

interface ClientFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  options: StatusOption[];
}

export function ClientFilters({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  options,
}: ClientFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <div className="flex gap-2 flex-wrap">
          {options.map((option) => (
            <Button
              key={option.value}
              variant={selectedStatus === option.value ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => onStatusChange(option.value)}
              className="rounded-full"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

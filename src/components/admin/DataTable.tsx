'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
  sortable?: boolean;
  sortKey?: string;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  sortConfig?: SortConfig;
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
}

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading = false,
  page = 1,
  totalPages = 1,
  onPageChange,
  onRowClick,
  emptyMessage = 'No data found',
  sortConfig,
  onSort,
}: DataTableProps<T>) {
  const handleSort = (column: Column<T>) => {
    if (!column.sortable || !onSort) return;
    
    const sortKey = column.sortKey || column.key;
    const newDirection = sortConfig?.key === sortKey && sortConfig?.direction === 'asc' ? 'desc' : 'asc';
    onSort(sortKey, newDirection);
  };

  const getSortIcon = (column: Column<T>) => {
    if (!column.sortable) return null;
    
    const sortKey = column.sortKey || column.key;
    if (sortConfig?.key !== sortKey) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1" />
      : <ArrowDown className="w-4 h-4 ml-1" />;
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_hsl(24_10%_10%/0.03)]">
        <Table>
          <TableHeader>
            <TableRow className="sticky top-0 z-10 border-b border-border bg-muted/50 backdrop-blur-sm hover:bg-muted/50">
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(
                    "px-4 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground",
                    column.sortable && "cursor-pointer hover:text-foreground transition-colors select-none",
                    column.className
                  )}
                  onClick={() => handleSort(column)}
                >
                  <div className="flex items-center">
                    {column.header}
                    {getSortIcon(column)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="px-4 py-12 text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-secondary" />
                  <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="px-4 py-12 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => (
                <TableRow
                  key={item.id}
                  onClick={() => onRowClick?.(item)}
                  className={cn(
                    "border-b border-border/60 transition-colors duration-[120ms] ease-[var(--ease-out)] hover:bg-muted/40 last:border-0",
                    onRowClick && "cursor-pointer"
                  )}
                >
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn("px-4 py-3 text-sm text-foreground", column.className)}
                    >
                      {column.render 
                        ? column.render(item) 
                        : (item as Record<string, unknown>)[column.key] as React.ReactNode}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">
            Page <span className="font-mono tabular-nums text-foreground">{page}</span> of{' '}
            <span className="font-mono tabular-nums text-foreground">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

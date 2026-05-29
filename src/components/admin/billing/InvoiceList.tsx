'use client';

import { FileText, AlertTriangle, CheckCircle } from 'lucide-react';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { formatCurrency } from '@/lib/format';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  services_rendered: string | null;
  created_at: string;
  due_date: string | null;
  client_name: string;
  client_email: string;
}

interface InvoiceListProps {
  invoices: Invoice[];
  loading: boolean;
}

function getStatusVariant(status: string) {
  switch (status) {
    case 'paid': return 'success' as const;
    case 'pending': return 'warning' as const;
    case 'void': return 'danger' as const;
    case 'refunded': return 'default' as const;
    default: return 'default' as const;
  }
}

const invoiceColumns = [
  {
    key: 'invoice_number',
    header: 'Invoice',
    render: (item: Invoice) => (
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/60">
          <FileText className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium font-mono">{item.invoice_number}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(item.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: 'client',
    header: 'Client',
    render: (item: Invoice) => (
      <div>
        <p className="font-medium">{item.client_name}</p>
        <p className="text-xs text-muted-foreground">{item.client_email}</p>
      </div>
    ),
  },
  {
    key: 'amount',
    header: 'Amount',
    render: (item: Invoice) => (
      <span className="font-medium">{formatCurrency(item.amount)}</span>
    ),
  },
  {
    key: 'services_rendered',
    header: 'Services',
    render: (item: Invoice) => {
      if (!item.services_rendered) {
        return (
          <span className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Not documented
          </span>
        );
      }
      try {
        const services = JSON.parse(item.services_rendered);
        return (
          <span className="text-xs text-success flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            {Array.isArray(services) ? `${services.length} service(s)` : 'Documented'}
          </span>
        );
      } catch {
        return <span className="text-xs text-muted-foreground">Documented</span>;
      }
    },
  },
  {
    key: 'status',
    header: 'Status',
    render: (item: Invoice) => (
      <StatusBadge status={item.status} variant={getStatusVariant(item.status)} />
    ),
  },
  {
    key: 'due_date',
    header: 'Due Date',
    render: (item: Invoice) => (
      <span className="text-sm text-muted-foreground">
        {item.due_date ? new Date(item.due_date).toLocaleDateString() : '-'}
      </span>
    ),
  },
];

export function InvoiceList({ invoices, loading }: InvoiceListProps) {
  return (
    <DataTable
      columns={invoiceColumns}
      data={invoices}
      loading={loading}
      emptyMessage="No invoices yet. Invoices are created from the client detail page after services are documented."
    />
  );
}

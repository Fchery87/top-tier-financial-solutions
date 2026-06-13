'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Mail,
  Phone,
  Eye,
  Trash2,
  RefreshCw,
  Plus,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge, getStatusVariant } from '@/components/admin/StatusBadge';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { StatGrid, type StatItem } from '@/components/admin/StatGrid';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/format';
import { getSafeFullName, getSafeInitials } from '@/lib/client-utils';
import { CreateClientModal } from '@/components/admin/clients/CreateClientModal';
import { EditClientModal } from '@/components/admin/clients/EditClientModal';
import { ClientFilters } from '@/components/admin/clients/ClientFilters';

interface Client {
  id: string;
  user_id: string | null;
  lead_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  notes: string | null;
  converted_at: string;
  created_at: string;
  updated_at: string;
  user_name: string | null;
}

const statusOptions = [
  { value: 'all', label: 'All Clients' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function ClientsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clients, setClients] = React.useState<Client[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedStatus, setSelectedStatus] = React.useState<string>(() => {
    const fromUrl = searchParams.get('status');
    const allowed = statusOptions.map((option) => option.value);
    return fromUrl && allowed.includes(fromUrl) ? fromUrl : 'all';
  });
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showConvertModal, setShowConvertModal] = React.useState(false);
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);

  const fetchClients = React.useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = selectedStatus !== 'all' ? `&status=${selectedStatus}` : '';
      const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : '';
      const response = await fetch(`/api/admin/clients?page=1&limit=100${statusParam}${searchParam}`);
      if (response.ok) {
        const data = await response.json();
        setClients(data.items);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, searchQuery]);

  React.useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      const response = await fetch(`/api/admin/clients/${pendingDeleteId}`, { method: 'DELETE' });
      if (response.ok) {
        fetchClients();
      }
    } catch (error) {
      console.error('Error deleting client:', error);
    } finally {
      setPendingDeleteId(null);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Client',
      render: (item: Client) => {
        const initials = getSafeInitials(item.first_name, item.last_name);
        const fullName = getSafeFullName(item.first_name, item.last_name);

        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted font-mono text-xs font-semibold text-foreground">
              {initials}
            </div>
            <div>
              <p className="font-medium">{fullName}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                {item.email || '—'}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (item: Client) => (
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <Phone className="w-3 h-3" />
          {item.phone || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Client) => (
        <StatusBadge
          status={item.status}
          variant={getStatusVariant(item.status)}
        />
      ),
    },
    {
      key: 'converted_at',
      header: 'Client Since',
      render: (item: Client) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(item.converted_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Client) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/admin/clients/${item.id}`);
            }}
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item.id);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  const activeCount = clients.filter(c => c.status === 'active').length;
  const pendingCount = clients.filter(c => c.status === 'pending').length;
  const completedCount = clients.filter(c => c.status === 'completed').length;

  const stats: StatItem[] = [
    { label: 'Total Clients', value: clients.length },
    { label: 'Active', value: activeCount, tone: 'up', href: '/admin/clients?status=active' },
    { label: 'Pending', value: pendingCount, tone: 'warning', href: '/admin/clients?status=pending' },
    { label: 'Completed', value: completedCount, tone: 'brass', href: '/admin/clients?status=completed' },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Case Management"
        title="Clients"
        description="Manage clients, agreements, and credit analysis."
        actions={
          <>
            <Button variant="outline" onClick={fetchClients} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => setShowConvertModal(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Convert Lead
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Button>
          </>
        }
      />

      <StatGrid items={stats} columns={4} />

      <ClientFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        options={statusOptions}
      />

      <DataTable
        columns={columns}
        data={clients}
        loading={loading}
        onRowClick={(item) => router.push(`/admin/clients/${item.id}`)}
        emptyMessage="No clients found. Add a new client or convert a lead to get started."
      />

      <CreateClientModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onClientCreated={fetchClients}
      />

      <EditClientModal
        open={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        onConverted={fetchClients}
      />

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title="Delete Client"
        description="Are you sure you want to delete this client? This will also delete all associated credit reports and analyses."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        variant="danger"
      />
    </div>
  );
}

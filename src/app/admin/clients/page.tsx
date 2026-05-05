'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Users,
  Mail,
  Phone,
  Eye,
  Trash2,
  RefreshCw,
  Plus,
  UserPlus,
  FileText,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge, getStatusVariant } from '@/components/admin/StatusBadge';
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
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-primary font-bold">
              {initials}
            </div>
            <div>
              <p className="font-medium">{fullName}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="w-3 h-3" />
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-serif font-bold text-foreground"
          >
            Clients
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Manage clients and credit analysis
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2"
        >
          <Button variant="outline" onClick={fetchClients} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => setShowConvertModal(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Convert Lead
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Client
          </Button>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-4 gap-4"
      >
        <Card className="bg-card border border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-pink-500/10">
              <Users className="w-6 h-6 text-pink-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{clients.length}</p>
              <p className="text-sm text-muted-foreground">Total Clients</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/10">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-yellow-500/10">
              <AlertTriangle className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <FileText className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedCount}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <ClientFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          options={statusOptions}
        />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <DataTable
          columns={columns}
          data={clients}
          loading={loading}
          onRowClick={(item) => router.push(`/admin/clients/${item.id}`)}
          emptyMessage="No clients found. Add a new client or convert a lead to get started."
        />
      </motion.div>

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

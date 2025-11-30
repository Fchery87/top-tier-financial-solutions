'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Mail, 
  Phone, 
  Eye, 
  Trash2,
  Filter,
  RefreshCw,
  Loader2,
  Plus,
  UserPlus,
  Search,
  FileText,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge, getStatusVariant } from '@/components/admin/StatusBadge';

interface Client {
  id: string;
  user_id: string | null;
  lead_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  status: string;
  notes: string | null;
  converted_at: string;
  created_at: string;
  updated_at: string;
  user_name: string | null;
}

interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  message: string | null;
  status: string;
  requested_at: string;
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
  const [clients, setClients] = React.useState<Client[]>([]);
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedStatus, setSelectedStatus] = React.useState<string>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showConvertModal, setShowConvertModal] = React.useState(false);
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [newClient, setNewClient] = React.useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    notes: '',
  });

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

  const fetchLeads = async () => {
    try {
      const response = await fetch('/api/admin/leads?page=1&limit=100&status=qualified');
      if (response.ok) {
        const data = await response.json();
        setLeads(data.items.filter((l: Lead) => l.status !== 'archived'));
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  React.useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  React.useEffect(() => {
    if (showConvertModal) {
      fetchLeads();
    }
  }, [showConvertModal]);

  const handleAddClient = async () => {
    if (!newClient.first_name || !newClient.last_name || !newClient.email) {
      alert('Please fill in required fields');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient),
      });

      if (response.ok) {
        setShowAddModal(false);
        setNewClient({ first_name: '', last_name: '', email: '', phone: '', notes: '' });
        fetchClients();
      }
    } catch (error) {
      console.error('Error adding client:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleConvertLead = async (lead: Lead) => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email,
          phone: lead.phone_number,
          lead_id: lead.id,
          notes: lead.message,
        }),
      });

      if (response.ok) {
        setShowConvertModal(false);
        setSelectedLead(null);
        fetchClients();
        fetchLeads();
      }
    } catch (error) {
      console.error('Error converting lead:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client? This will also delete all associated credit reports and analyses.')) return;
    
    try {
      const response = await fetch(`/api/admin/clients/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchClients();
      }
    } catch (error) {
      console.error('Error deleting client:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const columns = [
    {
      key: 'name',
      header: 'Client',
      render: (item: Client) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-primary font-bold">
            {item.first_name.charAt(0)}{item.last_name.charAt(0)}
          </div>
          <div>
            <p className="font-medium">{item.first_name} {item.last_name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {item.email}
            </p>
          </div>
        </div>
      ),
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
      {/* Header */}
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

      {/* Stats */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-4 gap-4"
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
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
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
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
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
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
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
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

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
      >
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <div className="flex gap-2 flex-wrap">
            {statusOptions.map((option) => (
              <Button
                key={option.value}
                variant={selectedStatus === option.value ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setSelectedStatus(option.value)}
                className="rounded-full"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Data Table */}
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

      {/* Add Client Modal */}
      {showAddModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowAddModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader>
                <CardTitle>Add New Client</CardTitle>
                <CardDescription>Enter client information to create a new record.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">First Name *</label>
                    <Input
                      value={newClient.first_name}
                      onChange={(e) => setNewClient({ ...newClient, first_name: e.target.value })}
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last Name *</label>
                    <Input
                      value={newClient.last_name}
                      onChange={(e) => setNewClient({ ...newClient, last_name: e.target.value })}
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Email *</label>
                  <Input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <textarea
                    value={newClient.notes}
                    onChange={(e) => setNewClient({ ...newClient, notes: e.target.value })}
                    placeholder="Additional notes..."
                    className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleAddClient} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Add Client
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Convert Lead Modal */}
      {showConvertModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowConvertModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg"
          >
            <Card className="bg-card border-border shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
              <CardHeader>
                <CardTitle>Convert Lead to Client</CardTitle>
                <CardDescription>Select a qualified lead to convert into an active client.</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto space-y-3">
                {leads.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No qualified leads available for conversion.
                  </p>
                ) : (
                  leads.map((lead) => (
                    <div
                      key={lead.id}
                      className="p-4 rounded-lg border border-border hover:border-secondary/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-primary font-bold">
                            {lead.first_name.charAt(0)}{lead.last_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium">{lead.first_name} {lead.last_name}</p>
                            <p className="text-xs text-muted-foreground">{lead.email}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConvertLead(lead);
                          }}
                          disabled={saving}
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Convert'}
                        </Button>
                      </div>
                      {lead.message && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{lead.message}</p>
                      )}
                    </div>
                  ))
                )}
                <div className="flex gap-2 pt-4 border-t border-border">
                  <Button variant="outline" className="flex-1" onClick={() => setShowConvertModal(false)}>
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

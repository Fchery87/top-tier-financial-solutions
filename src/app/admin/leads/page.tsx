'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Mail, 
  Phone, 
  MessageSquare, 
  Eye, 
  Trash2,
  Filter,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge, getStatusVariant } from '@/components/admin/StatusBadge';
import type { ContactFormSubmission, ConsultationStatus } from '@/lib/admin-api';

const statusOptions: { value: ConsultationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Leads' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'archived', label: 'Archived' },
];

export default function LeadsPage() {
  const [leads, setLeads] = React.useState<ContactFormSubmission[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedStatus, setSelectedStatus] = React.useState<ConsultationStatus | 'all'>('all');
  const [selectedLead, setSelectedLead] = React.useState<ContactFormSubmission | null>(null);
  const [updating, setUpdating] = React.useState(false);

  const fetchLeads = React.useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = selectedStatus !== 'all' ? `&status=${selectedStatus}` : '';
      const response = await fetch(`/api/admin/leads?page=1&limit=100${statusParam}`);
      if (response.ok) {
        const data = await response.json();
        setLeads(data.items);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedStatus]);

  React.useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleStatusUpdate = async (id: string, newStatus: ConsultationStatus) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/admin/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (response.ok) {
        fetchLeads();
        setSelectedLead(null);
      }
    } catch (error) {
      console.error('Error updating lead:', error);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    
    try {
      const response = await fetch(`/api/admin/leads/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchLeads();
      }
    } catch (error) {
      console.error('Error deleting lead:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getSafeInitials = (first: unknown, last: unknown) => {
    const firstName = typeof first === 'string' ? first.trim() : '';
    const lastName = typeof last === 'string' ? last.trim() : '';
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.trim() || '?';
  };

  const getSafeFullName = (first: unknown, last: unknown) => {
    const firstName = typeof first === 'string' ? first.trim() : '';
    const lastName = typeof last === 'string' ? last.trim() : '';
    return `${firstName} ${lastName}`.trim() || 'Unknown Lead';
  };

  const columns = [
    {
      key: 'name',
      header: 'Contact',
      render: (item: ContactFormSubmission) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-primary font-bold">
            {getSafeInitials(item.first_name, item.last_name)}
          </div>
          <div>
            <p className="font-medium">{getSafeFullName(item.first_name, item.last_name)}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Mail className="w-3 h-3" />
              {item.email || '—'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone_number',
      header: 'Phone',
      render: (item: ContactFormSubmission) => (
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <Phone className="w-3 h-3" />
          {item.phone_number || '—'}
        </span>
      ),
    },
    {
      key: 'message',
      header: 'Message',
      className: 'max-w-xs',
      render: (item: ContactFormSubmission) => (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {item.message || <span className="italic">No message</span>}
        </p>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: ContactFormSubmission) => (
        <StatusBadge 
          status={item.status} 
          variant={getStatusVariant(item.status)}
        />
      ),
    },
    {
      key: 'requested_at',
      header: 'Received',
      render: (item: ContactFormSubmission) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(item.requested_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: ContactFormSubmission) => (
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedLead(item);
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

  const newCount = leads.filter(l => l.status === 'new').length;
  const contactedCount = leads.filter(l => l.status === 'contacted').length;
  const qualifiedCount = leads.filter(l => l.status === 'qualified').length;

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
            Contact Leads
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Manage contact form submissions and leads
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2"
        >
          <Button variant="outline" onClick={fetchLeads} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
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
              <p className="text-2xl font-bold">{leads.length}</p>
              <p className="text-sm text-muted-foreground">Total Leads</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 border-blue-500/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <MessageSquare className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{newCount}</p>
              <p className="text-sm text-muted-foreground">New</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-yellow-500/10">
              <Phone className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{contactedCount}</p>
              <p className="text-sm text-muted-foreground">Contacted</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/10">
              <Users className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{qualifiedCount}</p>
              <p className="text-sm text-muted-foreground">Qualified</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex items-center gap-2"
      >
        <Filter className="w-4 h-4 text-muted-foreground" />
        <div className="flex gap-2">
          {statusOptions.map((option) => (
            <Button
              key={option.value}
              variant={selectedStatus === option.value ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setSelectedStatus(option.value)}
              className="rounded-full"
            >
              {option.label}
              {option.value !== 'all' && (
                <span className="ml-1 text-xs opacity-70">
                  ({leads.filter(l => l.status === option.value).length})
                </span>
              )}
            </Button>
          ))}
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
          data={leads}
          loading={loading}
          onRowClick={(item) => setSelectedLead(item)}
          emptyMessage="No leads found. Leads will appear here when visitors submit the contact form."
        />
      </motion.div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedLead(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg"
          >
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-primary font-bold text-lg">
                      {getSafeInitials(selectedLead.first_name, selectedLead.last_name)}
                      </div>
                      <div>
                      <CardTitle>{getSafeFullName(selectedLead.first_name, selectedLead.last_name)}</CardTitle>
                      <CardDescription>{selectedLead.email || '—'}</CardDescription>
                      </div>
                    </div>
                  <StatusBadge 
                    status={selectedLead.status} 
                    variant={getStatusVariant(selectedLead.status)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedLead.phone_number && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{selectedLead.phone_number}</span>
                  </div>
                )}
                {selectedLead.message && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Message:</p>
                    <p className="text-sm p-3 rounded-lg bg-muted/50">{selectedLead.message}</p>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border">
                  <span>Source: /{selectedLead.source_page_slug || 'unknown'}</span>
                  <span>Received: {new Date(selectedLead.requested_at).toLocaleString()}</span>
                </div>
                
                {/* Status Update Buttons */}
                <div className="space-y-2 pt-4 border-t border-border">
                  <p className="text-sm font-medium">Update Status:</p>
                  <div className="flex flex-wrap gap-2">
                    {(['new', 'contacted', 'qualified', 'archived'] as ConsultationStatus[]).map((status) => (
                      <Button
                        key={status}
                        variant={selectedLead.status === status ? 'secondary' : 'outline'}
                        size="sm"
                        disabled={updating || selectedLead.status === status}
                        onClick={() => handleStatusUpdate(selectedLead.id, status)}
                      >
                        {updating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setSelectedLead(null)}
                  >
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

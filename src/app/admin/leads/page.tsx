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
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { StatGrid } from '@/components/admin/StatGrid';
import type { ContactFormSubmission, ConsultationStatus } from '@/lib/admin-api';
import { formatTimeAgo } from '@/lib/format';
import { getSafeFullName, getSafeInitials } from '@/lib/client-utils';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

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
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null);

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

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteId) return;
    try {
      const response = await fetch(`/api/admin/leads/${pendingDeleteId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchLeads();
      }
    } catch (error) {
      console.error('Error deleting lead:', error);
    } finally {
      setPendingDeleteId(null);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Contact',
      render: (item: ContactFormSubmission) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted font-mono text-xs font-semibold text-foreground">
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
          {formatTimeAgo(item.requested_at)}
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
      <AdminPageHeader
        eyebrow="Operations"
        title="Contact Leads"
        description="Manage contact form submissions and inbound leads."
        actions={
          <Button variant="outline" onClick={fetchLeads} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <StatGrid
        items={[
          { label: 'Total Leads', value: leads.length },
          { label: 'New', value: newCount, tone: 'brass', icon: MessageSquare },
          { label: 'Contacted', value: contactedCount, tone: 'warning', icon: Phone },
          { label: 'Qualified', value: qualifiedCount, tone: 'up', icon: Users },
        ]}
        columns={4}
      />

      {/* Filters */}
      <div className="flex items-center gap-2">
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
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={leads}
        loading={loading}
        onRowClick={(item) => setSelectedLead(item)}
        emptyMessage="No leads found. Leads will appear here when visitors submit the contact form."
      />

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
      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
        title="Delete Lead"
        description="Are you sure you want to delete this lead?"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        variant="danger"
      />
    </div>
  );
}

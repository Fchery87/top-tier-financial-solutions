'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Plus, Scale, Check, X, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import type { Disclaimer } from '@/lib/admin-api';

export default function DisclaimersPage() {
  const [disclaimers, setDisclaimers] = React.useState<Disclaimer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingDisclaimer, setEditingDisclaimer] = React.useState<Disclaimer | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [formData, setFormData] = React.useState({
    name: '',
    content: '',
    display_hint: '',
    is_active: true,
  });

  const fetchDisclaimers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/disclaimers?page=1&limit=100');
      if (response.ok) {
        const data = await response.json();
        setDisclaimers(data.items);
      }
    } catch (error) {
      console.error('Error fetching disclaimers:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchDisclaimers();
  }, []);

  const openCreateModal = () => {
    setEditingDisclaimer(null);
    setFormData({
      name: '',
      content: '',
      display_hint: '',
      is_active: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (disclaimer: Disclaimer) => {
    setEditingDisclaimer(disclaimer);
    setFormData({
      name: disclaimer.name,
      content: disclaimer.content,
      display_hint: disclaimer.display_hint || '',
      is_active: disclaimer.is_active,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editingDisclaimer 
        ? `/api/admin/disclaimers/${editingDisclaimer.id}`
        : '/api/admin/disclaimers';
      
      const response = await fetch(url, {
        method: editingDisclaimer ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchDisclaimers();
      }
    } catch (error) {
      console.error('Error saving disclaimer:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (disclaimer: Disclaimer) => {
    try {
      const response = await fetch(`/api/admin/disclaimers/${disclaimer.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !disclaimer.is_active }),
      });

      if (response.ok) {
        fetchDisclaimers();
      }
    } catch (error) {
      console.error('Error toggling active status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this disclaimer?')) return;
    
    try {
      const response = await fetch(`/api/admin/disclaimers/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchDisclaimers();
      }
    } catch (error) {
      console.error('Error deleting disclaimer:', error);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (item: Disclaimer) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <Scale className="w-4 h-4 text-orange-500" />
          </div>
          <div>
            <p className="font-medium">{item.name}</p>
            {item.display_hint && (
              <p className="text-xs text-muted-foreground">Display: {item.display_hint}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'content',
      header: 'Content Preview',
      className: 'max-w-md',
      render: (item: Disclaimer) => (
        <p className="text-sm text-muted-foreground line-clamp-2">{item.content}</p>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (item: Disclaimer) => (
        <StatusBadge 
          status={item.is_active ? 'Active' : 'Inactive'} 
          variant={item.is_active ? 'success' : 'danger'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Disclaimer) => (
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              openEditModal(item);
            }}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleActive(item);
            }}
          >
            {item.is_active ? (
              <X className="w-4 h-4 text-destructive" />
            ) : (
              <Check className="w-4 h-4 text-green-500" />
            )}
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

  const activeCount = disclaimers.filter(d => d.is_active).length;

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
            Legal Disclaimers
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Manage legal disclaimers and compliance text
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Button 
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
            onClick={openCreateModal}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Disclaimer
          </Button>
        </motion.div>
      </div>

      {/* Stats */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-orange-500/10">
              <Scale className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{disclaimers.length}</p>
              <p className="text-sm text-muted-foreground">Total Disclaimers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/10">
              <Check className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Active</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Warning */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-orange-500">Important:</strong> Legal disclaimers are crucial for compliance. 
              Consult with a legal professional before making significant changes.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <DataTable
          columns={columns}
          data={disclaimers}
          loading={loading}
          emptyMessage="No disclaimers found. Add your first disclaimer to get started."
        />
      </motion.div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
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
                <CardTitle>{editingDisclaimer ? 'Edit Disclaimer' : 'Add Disclaimer'}</CardTitle>
                <CardDescription>
                  {editingDisclaimer ? 'Update disclaimer details' : 'Create a new legal disclaimer'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                    placeholder="General Disclaimer"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Display Hint</label>
                  <input
                    type="text"
                    value={formData.display_hint}
                    onChange={(e) => setFormData({ ...formData, display_hint: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                    placeholder="footer, testimonials, etc."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Content *</label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary min-h-[150px]"
                    placeholder="Enter the disclaimer text..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="is_active" className="text-sm">Active</label>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"
                    onClick={handleSave}
                    disabled={saving || !formData.name || !formData.content}
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingDisclaimer ? 'Update' : 'Create'}
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

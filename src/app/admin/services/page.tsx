'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Plus, Briefcase, Pencil, Trash2, Loader2, GripVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/admin/DataTable';

interface Service {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export default function ServicesPage() {
  const [services, setServices] = React.useState<Service[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingService, setEditingService] = React.useState<Service | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [formData, setFormData] = React.useState({
    name: '',
    description: '',
    order_index: 0,
  });

  const fetchServices = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/services?page=1&limit=100');
      if (response.ok) {
        const data = await response.json();
        setServices(data.items);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchServices();
  }, []);

  const openCreateModal = () => {
    setEditingService(null);
    setFormData({
      name: '',
      description: '',
      order_index: services.length,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      order_index: service.order_index,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editingService 
        ? `/api/admin/services/${editingService.id}`
        : '/api/admin/services';
      
      const response = await fetch(url, {
        method: editingService ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchServices();
      }
    } catch (error) {
      console.error('Error saving service:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    
    try {
      const response = await fetch(`/api/admin/services/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchServices();
      }
    } catch (error) {
      console.error('Error deleting service:', error);
    }
  };

  const columns = [
    {
      key: 'order_index',
      header: '#',
      render: (item: Service) => (
        <div className="flex items-center gap-2 text-muted-foreground">
          <GripVertical className="w-4 h-4" />
          {item.order_index + 1}
        </div>
      ),
    },
    {
      key: 'name',
      header: 'Service Name',
      render: (item: Service) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-secondary" />
          </div>
          <div>
            <p className="font-medium">{item.name}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      className: 'max-w-md',
      render: (item: Service) => (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {item.description || 'No description'}
        </p>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Service) => (
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
            Services
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Manage services displayed on the website
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
            Add Service
          </Button>
        </motion.div>
      </div>

      {/* Stats */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-secondary/10">
              <Briefcase className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{services.length}</p>
              <p className="text-sm text-muted-foreground">Total Services</p>
            </div>
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
          data={services}
          loading={loading}
          emptyMessage="No services found. Add your first service to get started."
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
                <CardTitle>{editingService ? 'Edit Service' : 'Add Service'}</CardTitle>
                <CardDescription>
                  {editingService ? 'Update service details' : 'Create a new service'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Service Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                    placeholder="Credit Report Analysis"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary min-h-[120px]"
                    placeholder="Describe the service..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Display Order</label>
                  <input
                    type="number"
                    value={formData.order_index}
                    onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                    min="0"
                  />
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
                    disabled={saving || !formData.name}
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingService ? 'Update' : 'Create'}
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

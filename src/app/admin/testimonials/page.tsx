'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Plus, MessageSquareQuote, Check, X, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import type { Testimonial } from '@/lib/admin-api';

export default function TestimonialsPage() {
  const [testimonials, setTestimonials] = React.useState<Testimonial[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingTestimonial, setEditingTestimonial] = React.useState<Testimonial | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [formData, setFormData] = React.useState({
    author_name: '',
    author_location: '',
    quote: '',
    order_index: 0,
    is_approved: false,
  });

  const fetchTestimonials = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/testimonials?page=1&limit=100');
      if (response.ok) {
        const data = await response.json();
        setTestimonials(data.items);
      }
    } catch (error) {
      console.error('Error fetching testimonials:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchTestimonials();
  }, []);

  const openCreateModal = () => {
    setEditingTestimonial(null);
    setFormData({
      author_name: '',
      author_location: '',
      quote: '',
      order_index: testimonials.length,
      is_approved: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (testimonial: Testimonial) => {
    setEditingTestimonial(testimonial);
    setFormData({
      author_name: testimonial.author_name,
      author_location: testimonial.author_location || '',
      quote: testimonial.quote,
      order_index: testimonial.order_index,
      is_approved: testimonial.is_approved,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editingTestimonial 
        ? `/api/admin/testimonials/${editingTestimonial.id}`
        : '/api/admin/testimonials';
      
      const response = await fetch(url, {
        method: editingTestimonial ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchTestimonials();
      }
    } catch (error) {
      console.error('Error saving testimonial:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleApproval = async (testimonial: Testimonial) => {
    try {
      const response = await fetch(`/api/admin/testimonials/${testimonial.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_approved: !testimonial.is_approved }),
      });

      if (response.ok) {
        fetchTestimonials();
      }
    } catch (error) {
      console.error('Error toggling approval:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this testimonial?')) return;
    
    try {
      const response = await fetch(`/api/admin/testimonials/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchTestimonials();
      }
    } catch (error) {
      console.error('Error deleting testimonial:', error);
    }
  };

  const columns = [
    {
      key: 'author_name',
      header: 'Author',
      render: (item: Testimonial) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/70 flex items-center justify-center text-primary font-bold">
            {item.author_name.charAt(0)}
          </div>
          <div>
            <p className="font-medium">{item.author_name}</p>
            <p className="text-xs text-muted-foreground">{item.author_location || 'No location'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'quote',
      header: 'Quote',
      className: 'max-w-md',
      render: (item: Testimonial) => (
        <p className="text-sm text-muted-foreground line-clamp-2">&ldquo;{item.quote}&rdquo;</p>
      ),
    },
    {
      key: 'is_approved',
      header: 'Status',
      render: (item: Testimonial) => (
        <StatusBadge 
          status={item.is_approved ? 'Approved' : 'Pending'} 
          variant={item.is_approved ? 'success' : 'warning'}
        />
      ),
    },
    {
      key: 'order_index',
      header: 'Order',
      render: (item: Testimonial) => (
        <span className="text-muted-foreground">#{item.order_index + 1}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Testimonial) => (
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className={`h-8 w-8 ${item.is_approved ? 'text-yellow-500 hover:text-yellow-600' : 'text-green-500 hover:text-green-600'}`}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleApproval(item);
            }}
          >
            {item.is_approved ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          </Button>
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

  const approvedCount = testimonials.filter(t => t.is_approved).length;
  const pendingCount = testimonials.filter(t => !t.is_approved).length;

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
            Testimonials
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Manage client testimonials and reviews
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
            Add Testimonial
          </Button>
        </motion.div>
      </div>

      {/* Stats */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-secondary/10">
              <MessageSquareQuote className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{testimonials.length}</p>
              <p className="text-sm text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/10">
              <Check className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{approvedCount}</p>
              <p className="text-sm text-muted-foreground">Approved</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-yellow-500/10">
              <X className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-sm text-muted-foreground">Pending Review</p>
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
          data={testimonials}
          loading={loading}
          emptyMessage="No testimonials found. Add your first testimonial to get started."
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
                <CardTitle>{editingTestimonial ? 'Edit Testimonial' : 'Add Testimonial'}</CardTitle>
                <CardDescription>
                  {editingTestimonial ? 'Update testimonial details' : 'Create a new testimonial'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Author Name *</label>
                  <input
                    type="text"
                    value={formData.author_name}
                    onChange={(e) => setFormData({ ...formData, author_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Location</label>
                  <input
                    type="text"
                    value={formData.author_location}
                    onChange={(e) => setFormData({ ...formData, author_location: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                    placeholder="New York, NY"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quote *</label>
                  <textarea
                    value={formData.quote}
                    onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary min-h-[100px]"
                    placeholder="Their testimonial..."
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div className="space-y-2 flex-1">
                    <label className="text-sm font-medium">Display Order</label>
                    <input
                      type="number"
                      value={formData.order_index}
                      onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                      min="0"
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <label className="text-sm font-medium">Status</label>
                    <div className="flex items-center gap-2 h-[42px]">
                      <input
                        type="checkbox"
                        id="is_approved"
                        checked={formData.is_approved}
                        onChange={(e) => setFormData({ ...formData, is_approved: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <label htmlFor="is_approved" className="text-sm">Approved</label>
                    </div>
                  </div>
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
                    disabled={saving || !formData.author_name || !formData.quote}
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingTestimonial ? 'Update' : 'Create'}
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

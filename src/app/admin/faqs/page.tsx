'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Plus, HelpCircle, Eye, EyeOff, Pencil, Trash2, GripVertical, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import type { FAQ } from '@/lib/admin-api';

export default function FAQsPage() {
  const [faqs, setFaqs] = React.useState<FAQ[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingFaq, setEditingFaq] = React.useState<FAQ | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [formData, setFormData] = React.useState({
    question: '',
    answer: '',
    display_order: 0,
    is_published: true,
  });

  const fetchFaqs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/faqs?page=1&limit=100');
      if (response.ok) {
        const data = await response.json();
        setFaqs(data.items);
      }
    } catch (error) {
      console.error('Error fetching FAQs:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchFaqs();
  }, []);

  const openCreateModal = () => {
    setEditingFaq(null);
    setFormData({
      question: '',
      answer: '',
      display_order: faqs.length,
      is_published: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (faq: FAQ) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      display_order: faq.display_order,
      is_published: faq.is_published,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editingFaq 
        ? `/api/admin/faqs/${editingFaq.id}`
        : '/api/admin/faqs';
      
      const response = await fetch(url, {
        method: editingFaq ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchFaqs();
      }
    } catch (error) {
      console.error('Error saving FAQ:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (faq: FAQ) => {
    try {
      const response = await fetch(`/api/admin/faqs/${faq.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: !faq.is_published }),
      });

      if (response.ok) {
        fetchFaqs();
      }
    } catch (error) {
      console.error('Error toggling publish status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this FAQ?')) return;
    
    try {
      const response = await fetch(`/api/admin/faqs/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchFaqs();
      }
    } catch (error) {
      console.error('Error deleting FAQ:', error);
    }
  };

  const columns = [
    {
      key: 'order',
      header: '',
      className: 'w-10',
      render: () => (
        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
      ),
    },
    {
      key: 'question',
      header: 'Question',
      render: (item: FAQ) => (
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10 mt-0.5">
            <HelpCircle className="w-4 h-4 text-purple-500" />
          </div>
          <div>
            <p className="font-medium">{item.question}</p>
            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{item.answer}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'is_published',
      header: 'Status',
      render: (item: FAQ) => (
        <StatusBadge 
          status={item.is_published ? 'Published' : 'Draft'} 
          variant={item.is_published ? 'success' : 'default'}
        />
      ),
    },
    {
      key: 'display_order',
      header: 'Order',
      render: (item: FAQ) => (
        <span className="text-muted-foreground">#{item.display_order + 1}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: FAQ) => (
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
              handleTogglePublish(item);
            }}
          >
            {item.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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

  const publishedCount = faqs.filter(f => f.is_published).length;

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
            FAQs
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Manage frequently asked questions
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
            Add FAQ
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
            <div className="p-3 rounded-xl bg-purple-500/10">
              <HelpCircle className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{faqs.length}</p>
              <p className="text-sm text-muted-foreground">Total FAQs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/10">
              <Eye className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{publishedCount}</p>
              <p className="text-sm text-muted-foreground">Published</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="bg-secondary/5 border-secondary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Tip:</strong> Only published FAQs will appear on the website.
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
          data={faqs}
          loading={loading}
          emptyMessage="No FAQs found. Add your first FAQ to get started."
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
                <CardTitle>{editingFaq ? 'Edit FAQ' : 'Add FAQ'}</CardTitle>
                <CardDescription>
                  {editingFaq ? 'Update FAQ details' : 'Create a new FAQ entry'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Question *</label>
                  <input
                    type="text"
                    value={formData.question}
                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                    placeholder="What is your question?"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Answer *</label>
                  <textarea
                    value={formData.answer}
                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary min-h-[120px]"
                    placeholder="Provide a detailed answer..."
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div className="space-y-2 flex-1">
                    <label className="text-sm font-medium">Display Order</label>
                    <input
                      type="number"
                      value={formData.display_order}
                      onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                      min="0"
                    />
                  </div>
                  <div className="space-y-2 flex-1">
                    <label className="text-sm font-medium">Status</label>
                    <div className="flex items-center gap-2 h-[42px]">
                      <input
                        type="checkbox"
                        id="is_published"
                        checked={formData.is_published}
                        onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <label htmlFor="is_published" className="text-sm">Published</label>
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
                    disabled={saving || !formData.question || !formData.answer}
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingFaq ? 'Update' : 'Create'}
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

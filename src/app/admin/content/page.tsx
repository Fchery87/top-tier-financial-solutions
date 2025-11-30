'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Plus, FileText, Eye, EyeOff, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import type { Page } from '@/lib/admin-api';

export default function ContentPage() {
  const [pages, setPages] = React.useState<Page[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingPage, setEditingPage] = React.useState<Page | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [formData, setFormData] = React.useState({
    slug: '',
    title: '',
    hero_headline: '',
    hero_subheadline: '',
    cta_text: '',
    cta_link: '',
    meta_title: '',
    meta_description: '',
    is_published: false,
  });

  const fetchPages = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/pages?page=1&limit=100');
      if (response.ok) {
        const data = await response.json();
        setPages(data.items);
      }
    } catch (error) {
      console.error('Error fetching pages:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchPages();
  }, []);

  const openCreateModal = () => {
    setEditingPage(null);
    setFormData({
      slug: '',
      title: '',
      hero_headline: '',
      hero_subheadline: '',
      cta_text: '',
      cta_link: '',
      meta_title: '',
      meta_description: '',
      is_published: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (page: Page) => {
    setEditingPage(page);
    setFormData({
      slug: page.slug,
      title: page.title,
      hero_headline: page.hero_headline || '',
      hero_subheadline: page.hero_subheadline || '',
      cta_text: page.cta_text || '',
      cta_link: page.cta_link || '',
      meta_title: page.meta_title || '',
      meta_description: page.meta_description || '',
      is_published: page.is_published,
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editingPage 
        ? `/api/admin/pages/${editingPage.id}`
        : '/api/admin/pages';
      
      const response = await fetch(url, {
        method: editingPage ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchPages();
      }
    } catch (error) {
      console.error('Error saving page:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (page: Page) => {
    try {
      const response = await fetch(`/api/admin/pages/${page.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: !page.is_published }),
      });

      if (response.ok) {
        fetchPages();
      }
    } catch (error) {
      console.error('Error toggling publish status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this page?')) return;
    
    try {
      const response = await fetch(`/api/admin/pages/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchPages();
      }
    } catch (error) {
      console.error('Error deleting page:', error);
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Page Title',
      render: (item: Page) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-secondary/10">
            <FileText className="w-4 h-4 text-secondary" />
          </div>
          <div>
            <p className="font-medium">{item.title}</p>
            <p className="text-xs text-muted-foreground">/{item.slug}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'is_published',
      header: 'Status',
      render: (item: Page) => (
        <StatusBadge 
          status={item.is_published ? 'Published' : 'Draft'} 
          variant={item.is_published ? 'success' : 'default'}
        />
      ),
    },
    {
      key: 'meta_title',
      header: 'SEO Title',
      render: (item: Page) => (
        <span className="text-muted-foreground text-sm truncate max-w-[200px] block">
          {item.meta_title || '—'}
        </span>
      ),
    },
    {
      key: 'updated_at',
      header: 'Last Updated',
      render: (item: Page) => (
        <span className="text-muted-foreground text-sm">
          {new Date(item.updated_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Page) => (
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
            Content Pages
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Manage your website pages and content
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
            Add Page
          </Button>
        </motion.div>
      </div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-secondary/5 border-secondary/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Note:</strong> This page manages dynamic content stored in the database. 
              Static pages in your codebase are managed via code.
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
          data={pages}
          loading={loading}
          emptyMessage="No pages found. Create your first page to get started."
        />
      </motion.div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl my-8"
          >
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader>
                <CardTitle>{editingPage ? 'Edit Page' : 'Add Page'}</CardTitle>
                <CardDescription>
                  {editingPage ? 'Update page details' : 'Create a new content page'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Slug *</label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                      placeholder="about-us"
                      disabled={!!editingPage}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Title *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                      placeholder="About Us"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Hero Headline</label>
                  <input
                    type="text"
                    value={formData.hero_headline}
                    onChange={(e) => setFormData({ ...formData, hero_headline: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                    placeholder="Welcome to Our Company"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Hero Subheadline</label>
                  <input
                    type="text"
                    value={formData.hero_subheadline}
                    onChange={(e) => setFormData({ ...formData, hero_subheadline: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                    placeholder="Your trusted partner in financial solutions"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">CTA Text</label>
                    <input
                      type="text"
                      value={formData.cta_text}
                      onChange={(e) => setFormData({ ...formData, cta_text: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                      placeholder="Get Started"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">CTA Link</label>
                    <input
                      type="text"
                      value={formData.cta_link}
                      onChange={(e) => setFormData({ ...formData, cta_link: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                      placeholder="/contact"
                    />
                  </div>
                </div>

                <div className="border-t border-border pt-4 mt-4">
                  <h4 className="text-sm font-medium mb-3">SEO Settings</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Meta Title</label>
                      <input
                        type="text"
                        value={formData.meta_title}
                        onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                        placeholder="About Us - Top Tier Financial"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Meta Description</label>
                      <textarea
                        value={formData.meta_description}
                        onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary min-h-[80px]"
                        placeholder="Learn about our mission and team..."
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="is_published"
                    checked={formData.is_published}
                    onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="is_published" className="text-sm">Published</label>
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
                    disabled={saving || !formData.slug || !formData.title}
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingPage ? 'Update' : 'Create'}
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

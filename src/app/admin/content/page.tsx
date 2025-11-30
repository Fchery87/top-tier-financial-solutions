'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Plus, FileText, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import type { Page } from '@/lib/admin-api';

// Mock data for demonstration
const mockPages: Page[] = [
  {
    id: '1',
    slug: 'home',
    title: 'Home Page',
    hero_headline: 'Welcome to Top Tier Financial',
    hero_subheadline: 'Expert credit repair services',
    main_content_json: null,
    cta_text: 'Get Started',
    cta_link: '/contact',
    meta_title: 'Top Tier Financial Solutions',
    meta_description: 'Expert credit repair and financial planning services.',
    is_published: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    slug: 'about',
    title: 'About Us',
    hero_headline: 'Our Story',
    hero_subheadline: null,
    main_content_json: null,
    cta_text: null,
    cta_link: null,
    meta_title: 'About Us - Top Tier Financial',
    meta_description: 'Learn about our mission and team.',
    is_published: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function ContentPage() {
  const [pages] = React.useState<Page[]>(mockPages);
  const [loading] = React.useState(false);

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
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            {item.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
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
          <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
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
    </div>
  );
}

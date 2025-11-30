'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Plus, HelpCircle, Eye, EyeOff, Pencil, Trash2, GripVertical } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import type { FAQ } from '@/lib/admin-api';

// Mock data for demonstration
const mockFAQs: FAQ[] = [
  {
    id: '1',
    question: 'What is credit repair?',
    answer: 'Credit repair is the process of fixing poor credit by disputing errors on your credit report and working with creditors to resolve negative items.',
    display_order: 0,
    is_published: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    question: 'How long does credit repair take?',
    answer: 'The timeline varies depending on your specific situation, but most clients see significant improvements within 3-6 months.',
    display_order: 1,
    is_published: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    question: 'Is credit repair legal?',
    answer: 'Yes, credit repair is 100% legal. The Credit Repair Organizations Act (CROA) protects consumers and regulates credit repair services.',
    display_order: 2,
    is_published: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '4',
    question: 'What documents do I need to get started?',
    answer: 'You will need a copy of your credit reports from all three bureaus, government-issued ID, and proof of address.',
    display_order: 3,
    is_published: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function FAQsPage() {
  const [faqs] = React.useState<FAQ[]>(mockFAQs);
  const [loading] = React.useState(false);

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
          <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
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
              <strong className="text-foreground">Tip:</strong> Drag and drop to reorder FAQs. 
              Only published FAQs will appear on the website.
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
    </div>
  );
}

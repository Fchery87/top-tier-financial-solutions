'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Plus, Scale, Check, X, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import type { Disclaimer } from '@/lib/admin-api';

// Mock data for demonstration
const mockDisclaimers: Disclaimer[] = [
  {
    id: '1',
    name: 'General Disclaimer',
    content: 'Top Tier Financial Solutions is not a law firm and does not provide legal advice. We are a credit repair organization...',
    display_hint: 'footer',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Results Disclaimer',
    content: 'Individual results may vary. Past performance is not indicative of future results. The testimonials on this website...',
    display_hint: 'testimonials',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'Affiliate Disclaimer',
    content: 'Some links on this website are affiliate links. We may earn a commission if you make a purchase through these links...',
    display_hint: 'footer',
    is_active: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function DisclaimersPage() {
  const [disclaimers] = React.useState<Disclaimer[]>(mockDisclaimers);
  const [loading] = React.useState(false);

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
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            {item.is_active ? (
              <X className="w-4 h-4 text-destructive" />
            ) : (
              <Check className="w-4 h-4 text-green-500" />
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
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
          <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
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
    </div>
  );
}

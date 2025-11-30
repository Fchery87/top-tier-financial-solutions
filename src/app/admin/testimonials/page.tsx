'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Plus, MessageSquareQuote, Check, X, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import type { Testimonial } from '@/lib/admin-api';

// Mock data for demonstration
const mockTestimonials: Testimonial[] = [
  {
    id: '1',
    author_name: 'Sarah Jenkins',
    author_location: 'New York, NY',
    quote: 'Top Tier Financial Solutions changed my life. I was able to buy my first home after they helped me clean up my credit report.',
    order_index: 0,
    is_approved: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    author_name: 'Michael Torres',
    author_location: 'Miami, FL',
    quote: 'Professional, transparent, and effective. They explained everything clearly and got results faster than I expected.',
    order_index: 1,
    is_approved: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    author_name: 'John Smith',
    author_location: 'Chicago, IL',
    quote: 'Amazing service! Would recommend to anyone looking to improve their credit score.',
    order_index: 2,
    is_approved: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function TestimonialsPage() {
  const [testimonials] = React.useState<Testimonial[]>(mockTestimonials);
  const [loading] = React.useState(false);

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
          {!item.is_approved && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-600">
              <Check className="w-4 h-4" />
            </Button>
          )}
          {item.is_approved && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-yellow-500 hover:text-yellow-600">
              <X className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
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
          <Button className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
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
    </div>
  );
}

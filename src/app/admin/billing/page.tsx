'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/Card';
import { BillingStatsCards } from '@/components/admin/billing/BillingStatsCards';
import { InvoiceList } from '@/components/admin/billing/InvoiceList';
import { FeeConfigSection } from '@/components/admin/billing/FeeConfigSection';

interface Invoice {
  id: string;
  client_id: string;
  invoice_number: string;
  amount: number;
  status: string;
  services_rendered: string | null;
  services_rendered_at: string | null;
  description: string | null;
  due_date: string | null;
  paid_at: string | null;
  payment_method: string | null;
  created_at: string;
  client_name: string;
  client_email: string;
}

interface FeeConfig {
  id: string;
  name: string;
  description: string | null;
  fee_model: string;
  amount: number;
  frequency: string | null;
  setup_fee: number;
  is_active: boolean;
  created_at: string;
}

interface BillingStats {
  total_invoices: number;
  total_revenue: number;
  pending_amount: number;
}

export default function BillingPage() {
  const [activeTab, setActiveTab] = React.useState<'invoices' | 'fee_configs'>('invoices');
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [feeConfigs, setFeeConfigs] = React.useState<FeeConfig[]>([]);
  const [stats, setStats] = React.useState<BillingStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchInvoices = async () => {
    try {
      const response = await fetch('/api/admin/billing?type=invoices&limit=100');
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.items);
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const fetchFeeConfigs = async () => {
    try {
      const response = await fetch('/api/admin/billing?type=fee_configs&limit=100');
      if (response.ok) {
        const data = await response.json();
        setFeeConfigs(data.items);
      }
    } catch (error) {
      console.error('Error fetching fee configs:', error);
    }
  };

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchInvoices(), fetchFeeConfigs()]);
      setLoading(false);
    };
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-serif font-bold text-foreground"
          >
            Billing & Invoices
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            CROA-compliant billing management (no advance fees)
          </motion.p>
        </div>
      </div>

      <BillingStatsCards stats={stats} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-amber-500">CROA Compliance:</strong> The Credit Repair Organizations Act
              prohibits collecting fees before services are rendered. All invoices require documented
              services before they can be created.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'invoices'
              ? 'border-secondary text-secondary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Invoices
        </button>
        <button
          onClick={() => setActiveTab('fee_configs')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'fee_configs'
              ? 'border-secondary text-secondary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Fee Plans
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {activeTab === 'invoices' ? (
          <InvoiceList invoices={invoices} loading={loading} />
        ) : (
          <FeeConfigSection
            feeConfigs={feeConfigs}
            loading={loading}
            onConfigChanged={fetchFeeConfigs}
          />
        )}
      </motion.div>
    </div>
  );
}

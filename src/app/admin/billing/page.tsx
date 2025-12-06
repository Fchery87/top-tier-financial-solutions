'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Plus, 
  DollarSign,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Pencil
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';

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

const FEE_MODELS = [
  { value: 'subscription', label: 'Monthly Subscription' },
  { value: 'pay_per_delete', label: 'Pay Per Delete' },
  { value: 'milestone', label: 'Milestone Based' },
  { value: 'flat_fee', label: 'Flat Fee' },
];

export default function BillingPage() {
  const [activeTab, setActiveTab] = React.useState<'invoices' | 'fee_configs'>('invoices');
  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [feeConfigs, setFeeConfigs] = React.useState<FeeConfig[]>([]);
  const [stats, setStats] = React.useState<BillingStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Fee Config Modal
  const [showFeeConfigModal, setShowFeeConfigModal] = React.useState(false);
  const [editingFeeConfig, setEditingFeeConfig] = React.useState<FeeConfig | null>(null);
  const [feeConfigForm, setFeeConfigForm] = React.useState({
    name: '',
    description: '',
    feeModel: 'subscription',
    amount: '',
    frequency: 'monthly',
    setupFee: '0',
  });

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

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'success';
      case 'pending': return 'warning';
      case 'void': return 'danger';
      case 'refunded': return 'default';
      default: return 'default';
    }
  };

  const openFeeConfigModal = (config?: FeeConfig) => {
    if (config) {
      setEditingFeeConfig(config);
      setFeeConfigForm({
        name: config.name,
        description: config.description || '',
        feeModel: config.fee_model,
        amount: (config.amount / 100).toString(),
        frequency: config.frequency || 'monthly',
        setupFee: (config.setup_fee / 100).toString(),
      });
    } else {
      setEditingFeeConfig(null);
      setFeeConfigForm({
        name: '',
        description: '',
        feeModel: 'subscription',
        amount: '',
        frequency: 'monthly',
        setupFee: '0',
      });
    }
    setShowFeeConfigModal(true);
  };

  const handleSaveFeeConfig = async () => {
    if (!feeConfigForm.name || !feeConfigForm.amount) {
      alert('Name and amount are required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'fee_config',
          name: feeConfigForm.name,
          description: feeConfigForm.description,
          feeModel: feeConfigForm.feeModel,
          amount: Math.round(parseFloat(feeConfigForm.amount) * 100),
          frequency: feeConfigForm.frequency,
          setupFee: Math.round(parseFloat(feeConfigForm.setupFee || '0') * 100),
        }),
      });

      if (response.ok) {
        setShowFeeConfigModal(false);
        fetchFeeConfigs();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save fee configuration');
      }
    } catch (error) {
      console.error('Error saving fee config:', error);
    } finally {
      setSaving(false);
    }
  };

  const invoiceColumns = [
    {
      key: 'invoice_number',
      header: 'Invoice',
      render: (item: Invoice) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="font-medium font-mono">{item.invoice_number}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(item.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      render: (item: Invoice) => (
        <div>
          <p className="font-medium">{item.client_name}</p>
          <p className="text-xs text-muted-foreground">{item.client_email}</p>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (item: Invoice) => (
        <span className="font-medium">{formatCurrency(item.amount)}</span>
      ),
    },
    {
      key: 'services_rendered',
      header: 'Services',
      render: (item: Invoice) => {
        if (!item.services_rendered) {
          return (
            <span className="text-xs text-red-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Not documented
            </span>
          );
        }
        try {
          const services = JSON.parse(item.services_rendered);
          return (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              {Array.isArray(services) ? `${services.length} service(s)` : 'Documented'}
            </span>
          );
        } catch {
          return <span className="text-xs text-muted-foreground">Documented</span>;
        }
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Invoice) => (
        <StatusBadge status={item.status} variant={getStatusVariant(item.status)} />
      ),
    },
    {
      key: 'due_date',
      header: 'Due Date',
      render: (item: Invoice) => (
        <span className="text-sm text-muted-foreground">
          {item.due_date ? new Date(item.due_date).toLocaleDateString() : '-'}
        </span>
      ),
    },
  ];

  const feeConfigColumns = [
    {
      key: 'name',
      header: 'Plan Name',
      render: (item: FeeConfig) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-green-500/10">
            <CreditCard className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <p className="font-medium">{item.name}</p>
            {item.description && (
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {item.description}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'fee_model',
      header: 'Type',
      render: (item: FeeConfig) => (
        <span className="text-sm capitalize">{item.fee_model.replace('_', ' ')}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (item: FeeConfig) => (
        <div>
          <p className="font-medium">{formatCurrency(item.amount)}</p>
          {item.frequency && (
            <p className="text-xs text-muted-foreground">/{item.frequency}</p>
          )}
        </div>
      ),
    },
    {
      key: 'setup_fee',
      header: 'Setup Fee',
      render: (item: FeeConfig) => (
        <span className="text-sm">{item.setup_fee > 0 ? formatCurrency(item.setup_fee) : '-'}</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (item: FeeConfig) => (
        <StatusBadge 
          status={item.is_active ? 'Active' : 'Inactive'} 
          variant={item.is_active ? 'success' : 'danger'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: FeeConfig) => (
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={() => openFeeConfigModal(item)}
          >
            <Pencil className="w-4 h-4" />
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

      {/* Stats */}
      {stats && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <FileText className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_invoices}</p>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-green-500/10">
                <DollarSign className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.total_revenue)}</p>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-yellow-500/10">
                <Clock className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(stats.pending_amount)}</p>
                <p className="text-sm text-muted-foreground">Pending Amount</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* CROA Notice */}
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

      {/* Tabs */}
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

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {activeTab === 'invoices' ? (
          <DataTable
            columns={invoiceColumns}
            data={invoices}
            loading={loading}
            emptyMessage="No invoices yet. Invoices are created from the client detail page after services are documented."
          />
        ) : (
          <>
            <div className="flex justify-end mb-4">
              <Button onClick={() => openFeeConfigModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Fee Plan
              </Button>
            </div>
            <DataTable
              columns={feeConfigColumns}
              data={feeConfigs}
              loading={loading}
              emptyMessage="No fee plans configured. Add your first fee plan to get started."
            />
          </>
        )}
      </motion.div>

      {/* Fee Config Modal */}
      {showFeeConfigModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowFeeConfigModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader>
                <CardTitle>{editingFeeConfig ? 'Edit Fee Plan' : 'Create Fee Plan'}</CardTitle>
                <CardDescription>Configure a pricing plan for clients</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Plan Name *</label>
                  <Input
                    value={feeConfigForm.name}
                    onChange={(e) => setFeeConfigForm({ ...feeConfigForm, name: e.target.value })}
                    placeholder="e.g., Standard Monthly Plan"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={feeConfigForm.description}
                    onChange={(e) => setFeeConfigForm({ ...feeConfigForm, description: e.target.value })}
                    placeholder="Brief description of this plan"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fee Model *</label>
                  <select
                    value={feeConfigForm.feeModel}
                    onChange={(e) => setFeeConfigForm({ ...feeConfigForm, feeModel: e.target.value })}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    {FEE_MODELS.map((model) => (
                      <option key={model.value} value={model.value}>{model.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Amount ($) *</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={feeConfigForm.amount}
                      onChange={(e) => setFeeConfigForm({ ...feeConfigForm, amount: e.target.value })}
                      placeholder="99.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Setup Fee ($)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={feeConfigForm.setupFee}
                      onChange={(e) => setFeeConfigForm({ ...feeConfigForm, setupFee: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {feeConfigForm.feeModel === 'subscription' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Frequency</label>
                    <select
                      value={feeConfigForm.frequency}
                      onChange={(e) => setFeeConfigForm({ ...feeConfigForm, frequency: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annually">Annually</option>
                    </select>
                  </div>
                )}
                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setShowFeeConfigModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={handleSaveFeeConfig}
                    disabled={saving || !feeConfigForm.name || !feeConfigForm.amount}
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingFeeConfig ? 'Update' : 'Create'}
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

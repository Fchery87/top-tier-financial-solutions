'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Loader2, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format';

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

const FEE_MODELS = [
  { value: 'subscription', label: 'Monthly Subscription' },
  { value: 'pay_per_delete', label: 'Pay Per Delete' },
  { value: 'milestone', label: 'Milestone Based' },
  { value: 'flat_fee', label: 'Flat Fee' },
];

interface FeeConfigSectionProps {
  feeConfigs: FeeConfig[];
  loading: boolean;
  onConfigChanged: () => void;
}

export function FeeConfigSection({ feeConfigs, loading, onConfigChanged }: FeeConfigSectionProps) {
  const [showModal, setShowModal] = React.useState(false);
  const [editingConfig, setEditingConfig] = React.useState<FeeConfig | null>(null);
  const [form, setForm] = React.useState({
    name: '',
    description: '',
    feeModel: 'subscription',
    amount: '',
    frequency: 'monthly',
    setupFee: '0',
  });
  const [saving, setSaving] = React.useState(false);

  const openModal = (config?: FeeConfig) => {
    if (config) {
      setEditingConfig(config);
      setForm({
        name: config.name,
        description: config.description || '',
        feeModel: config.fee_model,
        amount: (config.amount / 100).toString(),
        frequency: config.frequency || 'monthly',
        setupFee: (config.setup_fee / 100).toString(),
      });
    } else {
      setEditingConfig(null);
      setForm({
        name: '',
        description: '',
        feeModel: 'subscription',
        amount: '',
        frequency: 'monthly',
        setupFee: '0',
      });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.amount) {
      toast.error('Name and amount are required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/billing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'fee_config',
          name: form.name,
          description: form.description,
          feeModel: form.feeModel,
          amount: Math.round(parseFloat(form.amount) * 100),
          frequency: form.frequency,
          setupFee: Math.round(parseFloat(form.setupFee || '0') * 100),
        }),
      });

      if (response.ok) {
        setShowModal(false);
        onConfigChanged();
      } else {
        const err = await response.json();
        toast.error(err.error || 'Failed to save fee configuration');
      }
    } catch (error) {
      console.error('Error saving fee config:', error);
    } finally {
      setSaving(false);
    }
  };

  const feeConfigColumns = [
    {
      key: 'name',
      header: 'Plan Name',
      render: (item: FeeConfig) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/60">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
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
            onClick={() => openModal(item)}
          >
            <Pencil className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={() => openModal()}>
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

      {showModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md"
          >
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader>
                <CardTitle>{editingConfig ? 'Edit Fee Plan' : 'Create Fee Plan'}</CardTitle>
                <CardDescription>Configure a pricing plan for clients</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Plan Name *</label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., Standard Monthly Plan"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Brief description of this plan"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Fee Model *</label>
                  <select
                    value={form.feeModel}
                    onChange={(e) => setForm({ ...form, feeModel: e.target.value })}
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
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="99.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Setup Fee ($)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.setupFee}
                      onChange={(e) => setForm({ ...form, setupFee: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {form.feeModel === 'subscription' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Frequency</label>
                    <select
                      value={form.frequency}
                      onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annually">Annually</option>
                    </select>
                  </div>
                )}
                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSave}
                    disabled={saving || !form.name || !form.amount}
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingConfig ? 'Update' : 'Create'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}

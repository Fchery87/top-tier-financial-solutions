'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  FileSignature, 
  Pencil, 
  Trash2, 
  Loader2,
  Check,
  X,
  Eye,
  Copy
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/admin/DataTable';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { NY_SERVICE_AGREEMENT_TEMPLATE, REQUIRED_DISCLOSURES_NY } from '@/lib/service-agreement-template';

interface AgreementTemplate {
  id: string;
  name: string;
  version: string;
  content: string;
  required_disclosures: string | null;
  cancellation_period_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const DISCLOSURE_OPTIONS = [
  { value: 'right_to_cancel', label: 'Right to Cancel (CROA Required)' },
  { value: 'no_guarantee', label: 'No Guarantee Disclosure' },
  { value: 'credit_bureau_rights', label: 'Credit Bureau Rights' },
  { value: 'written_contract', label: 'Written Contract Notice' },
  { value: 'fee_disclosure', label: 'Fee Disclosure (No Advance Fees - NY Required)' },
  { value: 'ny_adverse_data', label: 'NY Time Limits on Adverse Data' },
  { value: 'information_statement', label: 'NY Information Statement (GBL 458-d)' },
];

// Use the comprehensive NY GBL Article 28-BB compliant template as default
const DEFAULT_TEMPLATE = NY_SERVICE_AGREEMENT_TEMPLATE;

export default function AgreementsPage() {
  const [templates, setTemplates] = React.useState<AgreementTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<AgreementTemplate | null>(null);
  const [previewContent, setPreviewContent] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const [formData, setFormData] = React.useState({
    name: '',
    version: '1.0',
    content: DEFAULT_TEMPLATE,
    requiredDisclosures: REQUIRED_DISCLOSURES_NY,
    cancellationPeriodDays: 3,
    isActive: true,
  });

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/agreements?type=templates&limit=100');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.items);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchTemplates();
  }, []);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      version: '1.0',
      content: DEFAULT_TEMPLATE,
      requiredDisclosures: REQUIRED_DISCLOSURES_NY,
      cancellationPeriodDays: 3,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (template: AgreementTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name || '',
      version: template.version || '1.0',
      content: template.content || '',
      requiredDisclosures: template.required_disclosures 
        ? JSON.parse(template.required_disclosures) 
        : REQUIRED_DISCLOSURES_NY,
      cancellationPeriodDays: template.cancellation_period_days ?? 3,
      isActive: template.is_active ?? false,
    });
    setIsModalOpen(true);
  };

  const openPreview = (template: AgreementTemplate) => {
    let content = template.content;
    content = content.replace(/\{\{client_name\}\}/g, 'John Doe');
    content = content.replace(/\{\{client_email\}\}/g, 'john.doe@example.com');
    content = content.replace(/\{\{client_phone\}\}/g, '(555) 123-4567');
    content = content.replace(/\{\{date\}\}/g, new Date().toLocaleDateString());
    content = content.replace(/\{\{company_name\}\}/g, 'Top Tier Financial Solutions');
    setPreviewContent(content);
    setIsPreviewOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.content) {
      alert('Name and content are required');
      return;
    }

    setSaving(true);
    try {
      const url = editingTemplate 
        ? `/api/admin/agreements/${editingTemplate.id}`
        : '/api/admin/agreements';
      
      const response = await fetch(url, {
        method: editingTemplate ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'template',
          name: formData.name,
          version: formData.version,
          content: formData.content,
          requiredDisclosures: formData.requiredDisclosures,
          cancellationPeriodDays: formData.cancellationPeriodDays,
          isActive: formData.isActive,
        }),
      });

      if (response.ok) {
        setIsModalOpen(false);
        fetchTemplates();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save template');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (template: AgreementTemplate) => {
    try {
      const response = await fetch(`/api/admin/agreements/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'template', isActive: !template.is_active }),
      });

      if (response.ok) {
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error toggling active status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template? This cannot be undone.')) return;
    
    try {
      const response = await fetch(`/api/admin/agreements/${id}?type=template`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  const handleDuplicate = (template: AgreementTemplate) => {
    setEditingTemplate(null);
    setFormData({
      name: `${template.name || ''} (Copy)`,
      version: '1.0',
      content: template.content || '',
      requiredDisclosures: template.required_disclosures 
        ? JSON.parse(template.required_disclosures) 
        : REQUIRED_DISCLOSURES_NY,
      cancellationPeriodDays: template.cancellation_period_days ?? 3,
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const toggleDisclosure = (value: string) => {
    setFormData(prev => {
      const current = prev.requiredDisclosures || [];
      return {
        ...prev,
        requiredDisclosures: current.includes(value)
          ? current.filter(d => d !== value)
          : [...current, value],
      };
    });
  };

  const columns = [
    {
      key: 'name',
      header: 'Template Name',
      render: (item: AgreementTemplate) => (
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <FileSignature className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="text-xs text-muted-foreground">Version {item.version}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'disclosures',
      header: 'Required Disclosures',
      render: (item: AgreementTemplate) => {
        const disclosures = item.required_disclosures 
          ? JSON.parse(item.required_disclosures) 
          : [];
        return (
          <span className="text-sm text-muted-foreground">
            {disclosures.length} disclosure(s)
          </span>
        );
      },
    },
    {
      key: 'cancellation',
      header: 'Cancel Period',
      render: (item: AgreementTemplate) => (
        <span className="text-sm">{item.cancellation_period_days} days</span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      render: (item: AgreementTemplate) => (
        <StatusBadge 
          status={item.is_active ? 'Active' : 'Inactive'} 
          variant={item.is_active ? 'success' : 'danger'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: AgreementTemplate) => (
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={(e) => { e.stopPropagation(); openPreview(item); }}
            title="Preview"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={(e) => { e.stopPropagation(); handleDuplicate(item); }}
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={(e) => { e.stopPropagation(); handleToggleActive(item); }}
            title={item.is_active ? 'Deactivate' : 'Activate'}
          >
            {item.is_active ? (
              <X className="w-4 h-4 text-destructive" />
            ) : (
              <Check className="w-4 h-4 text-green-500" />
            )}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  const activeCount = templates.filter(t => t.is_active).length;

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
            Agreement Templates
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            CROA-compliant client agreement templates
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Create Template
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
            <div className="p-3 rounded-xl bg-blue-500/10">
              <FileSignature className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{templates.length}</p>
              <p className="text-sm text-muted-foreground">Total Templates</p>
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
              <p className="text-sm text-muted-foreground">Active Templates</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* CROA Notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              <strong className="text-blue-500">CROA Compliance:</strong> All agreements include mandatory 
              3-day right to cancel, required disclosures, and prohibition on advance fees. 
              Templates should be reviewed by legal counsel.
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
          data={templates}
          loading={loading}
          emptyMessage="No agreement templates found. Create your first template to get started."
        />
      </motion.div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl my-8"
          >
            <Card className="bg-card border-border shadow-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>{editingTemplate ? 'Edit Template' : 'Create Agreement Template'}</CardTitle>
                <CardDescription>
                  Create a CROA-compliant client agreement template
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Template Name *</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                      placeholder="Standard Client Agreement"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Version</label>
                    <input
                      type="text"
                      value={formData.version || ''}
                      onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                      placeholder="1.0"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Cancellation Period (Days)</label>
                  <input
                    type="number"
                    min="3"
                    value={formData.cancellationPeriodDays ?? 3}
                    onChange={(e) => setFormData({ ...formData, cancellationPeriodDays: parseInt(e.target.value) || 3 })}
                    className="w-32 px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                  />
                  <p className="text-xs text-muted-foreground">CROA requires minimum 3 business days</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Required Disclosures</label>
                  <div className="grid grid-cols-2 gap-2">
                    {DISCLOSURE_OPTIONS.map((option) => (
                      <label key={option.value} className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(formData.requiredDisclosures || []).includes(option.value)}
                          onChange={() => toggleDisclosure(option.value)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Agreement Content (HTML) *</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Available placeholders: {`{{client_name}}, {{client_email}}, {{client_phone}}, {{date}}, {{company_name}}`}
                  </p>
                  <textarea
                    value={formData.content || ''}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-secondary min-h-[300px] font-mono text-sm"
                    placeholder="Enter HTML content..."
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formData.isActive ?? false}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <label htmlFor="is_active" className="text-sm">Active (available for use)</label>
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
                    variant="outline"
                    onClick={() => {
                      let content = formData.content;
                      content = content.replace(/\{\{client_name\}\}/g, 'John Doe');
                      content = content.replace(/\{\{client_email\}\}/g, 'john.doe@example.com');
                      content = content.replace(/\{\{client_phone\}\}/g, '(555) 123-4567');
                      content = content.replace(/\{\{date\}\}/g, new Date().toLocaleDateString());
                      content = content.replace(/\{\{company_name\}\}/g, 'Top Tier Financial Solutions');
                      setPreviewContent(content);
                      setIsPreviewOpen(true);
                    }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Preview
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={handleSave}
                    disabled={saving || !formData.name || !formData.content}
                  >
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingTemplate ? 'Update Template' : 'Create Template'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Preview Modal */}
      {isPreviewOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
          onClick={() => setIsPreviewOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl my-8"
          >
            <Card className="bg-white border-border shadow-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Agreement Preview</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setIsPreviewOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div 
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewContent }}
                />
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

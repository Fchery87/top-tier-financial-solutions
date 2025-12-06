'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Search,
  Filter,
  Eye,
  Copy,
  Loader2,
  RefreshCw,
  Plus,
  X,
  Building2,
  Users,
  Briefcase,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface Template {
  id: string;
  name: string;
  description: string | null;
  dispute_type: string;
  target_recipient: string;
  content: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
}

const DISPUTE_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'standard', label: 'Standard' },
  { value: 'method_of_verification', label: 'Method of Verification' },
  { value: 'direct_creditor', label: 'Direct to Creditor' },
  { value: 'goodwill', label: 'Goodwill' },
  { value: 'debt_validation', label: 'Debt Validation' },
  { value: 'cease_desist', label: 'Cease & Desist' },
  { value: 'cfpb_complaint', label: 'CFPB Complaint' },
  { value: 'identity_theft', label: 'Identity Theft' },
];

const TARGET_RECIPIENT_OPTIONS = [
  { value: 'all', label: 'All Recipients' },
  { value: 'bureau', label: 'Credit Bureau' },
  { value: 'creditor', label: 'Creditor' },
  { value: 'collector', label: 'Collector' },
];

const RECIPIENT_ICONS: Record<string, typeof Building2> = {
  bureau: Building2,
  creditor: Briefcase,
  collector: Users,
};

export default function DisputeTemplatesPage() {
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedType, setSelectedType] = React.useState('all');
  const [selectedRecipient, setSelectedRecipient] = React.useState('all');
  const [previewTemplate, setPreviewTemplate] = React.useState<Template | null>(null);
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [newTemplate, setNewTemplate] = React.useState({
    name: '',
    description: '',
    dispute_type: 'standard',
    target_recipient: 'bureau',
    content: '',
  });

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/dispute-templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
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

  const handleAddTemplate = async () => {
    if (!newTemplate.name || !newTemplate.content) {
      alert('Name and content are required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/dispute-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });

      if (response.ok) {
        setShowAddModal(false);
        setNewTemplate({
          name: '',
          description: '',
          dispute_type: 'standard',
          target_recipient: 'bureau',
          content: '',
        });
        fetchTemplates();
      }
    } catch (error) {
      console.error('Error adding template:', error);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = selectedType === 'all' || template.dispute_type === selectedType;
    const matchesRecipient = selectedRecipient === 'all' || template.target_recipient === selectedRecipient;
    return matchesSearch && matchesType && matchesRecipient;
  });

  const formatDisputeType = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      standard: 'bg-blue-500/20 text-blue-400',
      method_of_verification: 'bg-purple-500/20 text-purple-400',
      direct_creditor: 'bg-orange-500/20 text-orange-400',
      goodwill: 'bg-green-500/20 text-green-400',
      debt_validation: 'bg-yellow-500/20 text-yellow-400',
      cease_desist: 'bg-red-500/20 text-red-400',
      cfpb_complaint: 'bg-pink-500/20 text-pink-400',
      identity_theft: 'bg-cyan-500/20 text-cyan-400',
    };
    return colors[type] || 'bg-gray-500/20 text-gray-400';
  };

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
            Dispute Templates
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Library of dispute letter templates with FCRA, CRSA, and Metro 2 compliance
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2"
        >
          <Button variant="outline" onClick={fetchTemplates} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Template
          </Button>
        </motion.div>
      </div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-1 sm:grid-cols-4 gap-4"
      >
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <FileText className="w-6 h-6 text-blue-500" />
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
              <Building2 className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {templates.filter(t => t.target_recipient === 'bureau').length}
              </p>
              <p className="text-sm text-muted-foreground">Bureau Letters</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-orange-500/10">
              <Briefcase className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {templates.filter(t => t.target_recipient === 'creditor').length}
              </p>
              <p className="text-sm text-muted-foreground">Creditor Letters</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-purple-500/10">
              <Users className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {templates.filter(t => t.target_recipient === 'collector').length}
              </p>
              <p className="text-sm text-muted-foreground">Collector Letters</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Search and Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Type:</span>
            <div className="flex gap-1 flex-wrap">
              {DISPUTE_TYPE_OPTIONS.slice(0, 5).map((option) => (
                <Button
                  key={option.value}
                  variant={selectedType === option.value ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType(option.value)}
                  className="rounded-full text-xs"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Recipient:</span>
            <div className="flex gap-1">
              {TARGET_RECIPIENT_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={selectedRecipient === option.value ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedRecipient(option.value)}
                  className="rounded-full text-xs"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Templates Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-secondary" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {templates.length === 0
                  ? 'No templates found. Add your first template to get started.'
                  : 'No templates match your filters.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((template) => {
              const RecipientIcon = RECIPIENT_ICONS[template.target_recipient] || FileText;
              return (
                <Card
                  key={template.id}
                  className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/50 transition-colors cursor-pointer"
                  onClick={() => setPreviewTemplate(template)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 rounded-lg bg-secondary/10">
                        <RecipientIcon className="w-5 h-5 text-secondary" />
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(template.dispute_type)}`}>
                        {formatDisputeType(template.dispute_type)}
                      </span>
                    </div>
                    <h3 className="font-medium mb-1 line-clamp-1">{template.name}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.description || 'No description'}
                    </p>
                    <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground capitalize">
                        {template.target_recipient}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTemplate(template);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(template.content);
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Preview Modal */}
      {previewTemplate && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setPreviewTemplate(null)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[90vh] overflow-hidden"
          >
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle>{previewTemplate.name}</CardTitle>
                  <CardDescription>{previewTemplate.description}</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setPreviewTemplate(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(previewTemplate.dispute_type)}`}>
                    {formatDisputeType(previewTemplate.dispute_type)}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">
                    Target: {previewTemplate.target_recipient}
                  </span>
                </div>

                {previewTemplate.variables && previewTemplate.variables.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Variables:</p>
                    <div className="flex flex-wrap gap-2">
                      {previewTemplate.variables.map((variable) => (
                        <span
                          key={variable}
                          className="text-xs px-2 py-1 bg-muted rounded font-mono"
                        >
                          {`{{${variable}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border border-border rounded-lg overflow-hidden">
                  <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
                    <span className="text-sm font-medium">Template Content</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(previewTemplate.content)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copy
                    </Button>
                  </div>
                  <div className="p-4 max-h-[400px] overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm font-mono">
                      {previewTemplate.content}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}

      {/* Add Template Modal */}
      {showAddModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowAddModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          >
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader>
                <CardTitle>Add New Template</CardTitle>
                <CardDescription>Create a new dispute letter template</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Name *</label>
                  <Input
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    placeholder="e.g., Standard Bureau Dispute"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    value={newTemplate.description}
                    onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                    placeholder="Brief description of this template"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Dispute Type</label>
                    <select
                      value={newTemplate.dispute_type}
                      onChange={(e) => setNewTemplate({ ...newTemplate, dispute_type: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      {DISPUTE_TYPE_OPTIONS.filter(o => o.value !== 'all').map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Target Recipient</label>
                    <select
                      value={newTemplate.target_recipient}
                      onChange={(e) => setNewTemplate({ ...newTemplate, target_recipient: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      {TARGET_RECIPIENT_OPTIONS.filter(o => o.value !== 'all').map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Content *</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Use {`{{variable_name}}`} for placeholders (e.g., {`{{client_name}}`}, {`{{account_number}}`})
                  </p>
                  <textarea
                    value={newTemplate.content}
                    onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                    placeholder="Enter the template content..."
                    className="w-full min-h-[300px] px-3 py-2 text-sm font-mono rounded-md border border-input bg-background"
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setShowAddModal(false)}>
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleAddTemplate} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Add Template
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

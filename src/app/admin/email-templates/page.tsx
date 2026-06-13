'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { StatGrid } from '@/components/admin/StatGrid';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Mail,
  Sparkles,
  Eye,
  Code2,
  FileText,
  Loader2,
  X,
  ChevronRight,
  Zap,
  TrendingUp,
  CheckCircle2
} from 'lucide-react';

interface EmailTemplate {
  id: string;
  name: string;
  trigger_type: string;
  subject: string;
  html_content: string;
  text_content: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
}

const TRANSACTIONAL_TRIGGERS = [
  'welcome',
  'agreement_sent',
  'agreement_signed',
  'dispute_sent',
  'response_received',
  'item_deleted',
  'progress_report',
  'payment_received'
];

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = React.useState<EmailTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedTemplate, setSelectedTemplate] = React.useState<EmailTemplate | null>(null);
  const [showPreview, setShowPreview] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'all' | 'transactional' | 'marketing'>('all');

  React.useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/admin/email-templates');
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

  const isTransactional = (triggerType: string) => TRANSACTIONAL_TRIGGERS.includes(triggerType);

  const formatTriggerType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const filteredTemplates = React.useMemo(() => {
    if (activeTab === 'transactional') {
      return templates.filter(t => isTransactional(t.trigger_type));
    }
    if (activeTab === 'marketing') {
      return templates.filter(t => !isTransactional(t.trigger_type));
    }
    return templates;
  }, [templates, activeTab]);

  const transactionalCount = templates.filter(t => isTransactional(t.trigger_type)).length;
  const marketingCount = templates.length - transactionalCount;
  const activeCount = templates.filter(t => t.is_active).length;

  if (loading) {
    return (
      <AdminGuard>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-secondary" />
            <p className="mt-4 text-muted-foreground">Loading email templates...</p>
          </div>
        </div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="space-y-6">
        <AdminPageHeader
          eyebrow="Content"
          title="Email Templates"
          description="Automated communication workflows for client engagement."
          actions={
            <Button variant="outline" size="sm">
              <Sparkles className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          }
        />

        <StatGrid
          items={[
            { label: 'Total Templates', value: templates.length, icon: Mail, tone: 'brass' },
            { label: 'Transactional', value: transactionalCount, icon: Zap },
            { label: 'Marketing', value: marketingCount, icon: TrendingUp, tone: 'brass' },
            { label: 'Active', value: activeCount, icon: CheckCircle2, tone: 'up' },
          ]}
          columns={4}
        />

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All Templates', icon: Mail },
            { value: 'transactional', label: 'Transactional', icon: Zap },
            { value: 'marketing', label: 'Marketing', icon: TrendingUp }
          ].map((tab) => (
            <Button
              key={tab.value}
              variant={activeTab === tab.value ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(tab.value as typeof activeTab)}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className="group h-full cursor-pointer rounded-none border-0 bg-card shadow-none transition-colors duration-[160ms] ease-[var(--ease-out)] hover:bg-muted/40"
              onClick={() => {
                setSelectedTemplate(template);
                setShowPreview(true);
              }}
            >
              <CardContent className="pt-6">
                {/* Header */}
                <div className="mb-4 flex items-start justify-between">
                  {isTransactional(template.trigger_type) ? (
                    <Zap className="h-5 w-5 text-secondary" strokeWidth={1.75} />
                  ) : (
                    <TrendingUp className="h-5 w-5 text-secondary" strokeWidth={1.75} />
                  )}
                  {template.is_active && (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-up" />
                      Active
                    </span>
                  )}
                </div>

                {/* Content */}
                <h3 className="mb-2 line-clamp-1 text-lg font-semibold tracking-tight text-foreground">
                  {template.name}
                </h3>

                <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
                  {template.subject}
                </p>

                {/* Meta */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <code className="rounded border border-border bg-muted/50 px-2 py-1 font-mono">
                    {template.trigger_type}
                  </code>
                  <span className="flex items-center gap-1">
                    <Code2 className="h-3 w-3" />
                    {template.variables.length} vars
                  </span>
                </div>

                {/* Hover Action */}
                <div className="mt-4 border-t border-border pt-4 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex items-center text-sm font-medium text-secondary">
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                    <ChevronRight className="ml-auto h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {filteredTemplates.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <div className="p-4 bg-gradient-to-br from-secondary/10 to-secondary/5 rounded-2xl inline-block mb-4 glow-gold">
              <Mail className="w-12 h-12 text-secondary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">No templates found</h3>
            <p className="text-muted-foreground">
              {activeTab === 'all' 
                ? 'Start by creating your first email template'
                : `No ${activeTab} templates available`
              }
            </p>
          </motion.div>
        )}

        {/* Preview Modal */}
        <AnimatePresence>
          {showPreview && selectedTemplate && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              onClick={() => setShowPreview(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="glass-card border-secondary/20 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col glow-gold-strong"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-6 py-4 border-b border-secondary/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-secondary/20 to-secondary/5 rounded-lg">
                      {isTransactional(selectedTemplate.trigger_type) ? (
                        <Zap className="w-5 h-5 text-secondary" />
                      ) : (
                        <TrendingUp className="w-5 h-5 text-secondary" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-sans font-bold text-secondary">
                        {selectedTemplate.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {formatTriggerType(selectedTemplate.trigger_type)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPreview(false)}
                    className="hover:bg-secondary/10"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                  {/* Subject */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Subject Line
                    </label>
                    <div className="p-4 bg-muted/30 rounded-lg border border-secondary/10">
                      <p className="text-sm text-foreground">{selectedTemplate.subject}</p>
                    </div>
                  </div>

                  {/* Variables */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-3">
                      Available Variables ({selectedTemplate.variables.length})
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.variables.map((variable) => (
                        <code
                          key={variable}
                          className="px-3 py-1.5 text-xs font-mono bg-secondary/10 text-secondary rounded-lg border border-secondary/20"
                        >
                          {`{{${variable}}}`}
                        </code>
                      ))}
                    </div>
                  </div>

                  {/* HTML Preview */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Email Preview
                    </label>
                    <div className="border border-secondary/20 rounded-lg overflow-hidden bg-white">
                      <iframe
                        srcDoc={selectedTemplate.html_content}
                        className="w-full h-96"
                        title="Email Preview"
                      />
                    </div>
                  </div>

                  {/* Plain Text */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Plain Text Version
                    </label>
                    <pre className="p-4 bg-muted/30 rounded-lg border border-secondary/10 text-xs whitespace-pre-wrap font-mono text-muted-foreground max-h-60 overflow-y-auto">
                      {selectedTemplate.text_content}
                    </pre>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-secondary/10 flex justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-secondary/20 hover:bg-secondary/10"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Edit Template
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPreview(false)}
                    className="border-secondary/30 hover:bg-secondary/10"
                  >
                    Close
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminGuard>
  );
}

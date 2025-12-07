'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Mail,
  MailOpen,
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
        <div className="flex items-center justify-center min-h-screen">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <Loader2 className="w-12 h-12 text-secondary animate-spin mx-auto glow-gold" />
            <p className="mt-4 text-muted-foreground">Loading email templates...</p>
          </motion.div>
        </div>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <div className="min-h-screen">
        {/* Premium Header with Gradient Background */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-8 pb-8"
        >
          {/* Decorative Background Gradient */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[120px] animate-pulse-glow" />
            <div className="absolute top-20 left-20 w-[300px] h-[300px] bg-primary/5 rounded-full blur-[100px]" />
          </div>

          <div className="flex items-start justify-between">
            <div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-3 mb-4"
              >
                <div className="p-3 bg-gradient-to-br from-secondary/20 to-secondary/5 rounded-2xl glow-gold">
                  <MailOpen className="w-8 h-8 text-secondary" />
                </div>
                <div>
                  <h1 className="text-4xl font-serif font-bold text-gradient-gold">
                    Email Templates
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    Automated communication workflows for client engagement
                  </p>
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                variant="outline"
                size="sm"
                className="border-secondary/30 hover:bg-secondary/10 hover:border-secondary"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* Stats Cards - Premium Glass Effect */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"
        >
          <Card className="glass-card border-secondary/10 hover:border-secondary/30 transition-all duration-300 card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Total Templates</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{templates.length}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-secondary/20 to-secondary/5 rounded-xl">
                  <Mail className="w-6 h-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-primary/10 hover:border-primary/30 transition-all duration-300 card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Transactional</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{transactionalCount}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-purple-500/10 hover:border-purple-500/30 transition-all duration-300 card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Marketing</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{marketingCount}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-purple-500/10 to-purple-500/5 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-green-500/10 hover:border-green-500/30 transition-all duration-300 card-hover">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">Active</p>
                  <p className="text-3xl font-bold text-foreground mt-2">{activeCount}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-xl">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Filter Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-2 mb-6"
        >
          {[
            { value: 'all', label: 'All Templates', icon: Mail },
            { value: 'transactional', label: 'Transactional', icon: Zap },
            { value: 'marketing', label: 'Marketing', icon: TrendingUp }
          ].map((tab, _index) => (
            <Button
              key={tab.value}
              variant={activeTab === tab.value ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setActiveTab(tab.value as typeof activeTab)}
              className={
                activeTab === tab.value
                  ? 'bg-secondary text-secondary-foreground hover:bg-secondary/90 glow-gold'
                  : 'border-secondary/20 hover:bg-secondary/10'
              }
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </Button>
          ))}
        </motion.div>

        {/* Templates Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredTemplates.map((template, index) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <Card
                className="glass-card border-secondary/10 hover:border-secondary/30 transition-all duration-300 card-hover cursor-pointer h-full group"
                onClick={() => {
                  setSelectedTemplate(template);
                  setShowPreview(true);
                }}
              >
                <CardContent className="pt-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-2 bg-gradient-to-br from-secondary/15 to-secondary/5 rounded-lg group-hover:glow-gold transition-all">
                      {isTransactional(template.trigger_type) ? (
                        <Zap className="w-5 h-5 text-secondary" />
                      ) : (
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      {template.is_active && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-700 border border-green-500/20">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-semibold text-foreground mb-2 line-clamp-1">
                    {template.name}
                  </h3>
                  
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {template.subject}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <code className="px-2 py-1 bg-muted/50 rounded border border-secondary/10">
                      {template.trigger_type}
                    </code>
                    <span className="flex items-center gap-1">
                      <Code2 className="w-3 h-3" />
                      {template.variables.length} vars
                    </span>
                  </div>

                  {/* Hover Action */}
                  <div className="mt-4 pt-4 border-t border-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center text-sm font-medium text-secondary">
                      <Eye className="w-4 h-4 mr-2" />
                      View Details
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

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
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-serif font-bold text-gradient-gold">
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

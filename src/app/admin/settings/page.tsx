'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Sparkles,
  Database,
  Server,
  AlertCircle,
  Save,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LLMConfigSection } from '@/components/admin/settings/LLMConfigSection';
import { DashboardPrefsSection } from '@/components/admin/settings/DashboardPrefsSection';
import { SystemSettingsSection } from '@/components/admin/settings/SystemSettingsSection';

interface LLMConfig {
  provider: string;
  model: string;
  apiKey?: string;
  apiEndpoint?: string;
  temperature: number;
  maxTokens: number;
  hasApiKey: boolean;
}

interface SystemSetting {
  id: string;
  settingKey: string;
  settingValue: string | null;
  settingType: string;
  category: string;
  description: string | null;
  isSecret: boolean;
  parsedValue: SettingValue;
}

type SettingValue = string | number | boolean | Record<string, unknown> | unknown[] | null;

interface DashboardPreferences {
  defaultDensity: 'comfortable' | 'compact';
  showWorkQueue: boolean;
}

export default function SettingsPage() {
  const [llmConfig, setLlmConfig] = React.useState<LLMConfig | null>(null);
  const [allSettings, setAllSettings] = React.useState<SystemSetting[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null);
  const [editedConfig, setEditedConfig] = React.useState<Partial<LLMConfig>>({});
  const [hasChanges, setHasChanges] = React.useState(false);
  const [dashboardPrefs, setDashboardPrefs] = React.useState<DashboardPreferences>({
    defaultDensity: 'comfortable',
    showWorkQueue: true,
  });
  const [dashboardHasChanges, setDashboardHasChanges] = React.useState(false);

  const fetchLLMConfig = React.useCallback(async () => {
    try {
      const response = await fetch('/api/admin/settings/llm');
      if (response.ok) {
        const data = await response.json();
        setLlmConfig(data.config);
        setEditedConfig({});
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Error fetching LLM config:', error);
    }
  }, []);

  const fetchAllSettings = React.useCallback(async () => {
    try {
      const response = await fetch('/api/admin/settings');
      if (response.ok) {
        const data = await response.json();
        setAllSettings(data.settings);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  }, []);

  React.useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchLLMConfig(), fetchAllSettings()]);
      setLoading(false);
    };
    loadData();
  }, [fetchLLMConfig, fetchAllSettings]);

  React.useEffect(() => {
    if (!allSettings || allSettings.length === 0) return;

    const byKey = new Map(allSettings.map((s) => [s.settingKey, s]));
    const densitySetting = byKey.get('dashboard.default_density');
    const workQueueSetting = byKey.get('dashboard.show_work_queue');

    const defaultDensity =
      typeof densitySetting?.parsedValue === 'string' &&
      (densitySetting.parsedValue === 'comfortable' || densitySetting.parsedValue === 'compact')
        ? (densitySetting.parsedValue as 'comfortable' | 'compact')
        : 'comfortable';

    const showWorkQueue =
      typeof workQueueSetting?.parsedValue === 'boolean'
        ? (workQueueSetting.parsedValue as boolean)
        : true;

    setDashboardPrefs({ defaultDensity, showWorkQueue });
    setDashboardHasChanges(false);
  }, [allSettings]);

  const handleConfigChange = (field: keyof LLMConfig, value: string | number | boolean) => {
    setEditedConfig(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setTestResult(null);
  };

  const handleSaveAll = async () => {
    if ((!hasChanges || !llmConfig) && !dashboardHasChanges) return;

    setSaving(true);
    try {
      if (hasChanges && llmConfig) {
        const updates: Partial<LLMConfig> = {};
        (Object.keys(editedConfig) as (keyof LLMConfig)[]).forEach((key) => {
          if (editedConfig[key] !== undefined) {
            (updates as Record<string, unknown>)[key] = editedConfig[key];
          }
        });

        const response = await fetch('/api/admin/settings/llm', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          throw new Error('Failed to save LLM configuration');
        }
      }

      if (dashboardHasChanges) {
        const requests = [
          fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: 'dashboard.default_density',
              value: dashboardPrefs.defaultDensity,
              type: 'string',
              category: 'dashboard',
              description: 'Default density mode for Admin dashboard (comfortable/compact)',
              isSecret: false,
            }),
          }),
          fetch('/api/admin/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: 'dashboard.show_work_queue',
              value: dashboardPrefs.showWorkQueue,
              type: 'boolean',
              category: 'dashboard',
              description: 'Show Work Queue widget on Admin dashboard',
              isSecret: false,
            }),
          }),
        ];

        const results = await Promise.all(requests);
        const anyFailed = results.some((r) => !r.ok);
        if (anyFailed) {
          throw new Error('Failed to save dashboard preferences');
        }
      }

      await Promise.all([fetchLLMConfig(), fetchAllSettings()]);
      setHasChanges(false);
      setDashboardHasChanges(false);
      setTestResult({ success: true, message: 'Configuration saved successfully!' });
      setTimeout(() => setTestResult(null), 3000);
    } catch (error) {
      console.error('Error saving config:', error);
      setTestResult({ success: false, message: 'Error saving configuration' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      if (hasChanges) {
        const response = await fetch('/api/admin/settings/llm', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editedConfig),
        });

        if (!response.ok) {
          setTestResult({ success: false, message: 'Failed to save configuration before testing' });
          setTesting(false);
          return;
        }
        await fetchLLMConfig();
        setHasChanges(false);
      }

      const response = await fetch('/api/admin/settings/llm/test', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setTestResult({
          success: true,
          message: `✓ Connection successful! Response: "${data.response || 'OK'}"`,
        });
      } else {
        setTestResult({
          success: false,
          message: `✗ Connection failed: ${data.error || 'Unknown error'}`,
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Network error';
      setTestResult({
        success: false,
        message: `✗ Test failed: ${message || 'Network error'}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const totalSettingsCount = allSettings.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-sans font-bold text-foreground flex items-center gap-3"><SettingsIcon className="w-8 h-8 text-primary" />System Settings</h1>
          <p className="text-muted-foreground mt-1">Configure LLM providers, API keys, and system-wide settings</p>
        </div>

        <div className="flex items-center gap-3">
          {(hasChanges || dashboardHasChanges) && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 text-sm text-warning bg-warning/10 px-3 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4" />Unsaved changes
            </motion.div>
          )}
          <Button onClick={handleSaveAll} disabled={(!hasChanges && !dashboardHasChanges) || saving} variant="primary" size="md">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-muted-foreground">LLM Provider</p><p className="text-2xl font-bold text-primary capitalize mt-1">{llmConfig?.provider || 'Not Set'}</p></div>
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-muted-foreground">Active Model</p><p className="text-2xl font-bold text-foreground mt-1">{llmConfig?.model || 'N/A'}</p></div>
                <Server className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-muted-foreground">Total Settings</p><p className="text-2xl font-bold text-foreground mt-1">{totalSettingsCount}</p></div>
                <Database className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {testResult && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
          <Card className={testResult.success ? 'border-success/30 bg-success/10' : 'border-destructive/30 bg-destructive/10'}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                {testResult.success ? <CheckCircle2 className="w-5 h-5 text-success" /> : <AlertCircle className="w-5 h-5 text-destructive" />}
                <p className={testResult.success ? 'text-success' : 'text-destructive'}>{testResult.message}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <LLMConfigSection config={llmConfig} onConfigChange={handleConfigChange} onSave={handleSaveAll} onTest={handleTestConnection} saving={saving} testing={testing} hasChanges={hasChanges} />
      <DashboardPrefsSection preferences={dashboardPrefs} onChange={(prefs) => { setDashboardPrefs(prefs); setDashboardHasChanges(true); setTestResult(null); }} />

      <SystemSettingsSection settings={allSettings} />
    </div>
  );
}

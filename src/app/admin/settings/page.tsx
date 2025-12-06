'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { 
  Settings as SettingsIcon, 
  Sparkles,
  Database,
  Key,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  TestTube2,
  Server,
  Lock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

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

export default function SettingsPage() {
  const [llmConfig, setLlmConfig] = React.useState<LLMConfig | null>(null);
  const [allSettings, setAllSettings] = React.useState<SystemSetting[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null);
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [editedConfig, setEditedConfig] = React.useState<Partial<LLMConfig>>({});
  const [hasChanges, setHasChanges] = React.useState(false);

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

  const handleConfigChange = (field: keyof LLMConfig, value: string | number | boolean) => {
    setEditedConfig(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setTestResult(null);
  };

  const handleSaveConfig = async () => {
    if (!hasChanges || !llmConfig) return;

    setSaving(true);
    try {
      const updates: Partial<LLMConfig> = {};
      (Object.keys(editedConfig) as (keyof LLMConfig)[]).forEach(key => {
        if (editedConfig[key] !== undefined) {
          (updates as Record<string, unknown>)[key] = editedConfig[key];
        }
      });

      const response = await fetch('/api/admin/settings/llm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await fetchLLMConfig();
        await fetchAllSettings();
        setTestResult({ success: true, message: 'Configuration saved successfully!' });
        setTimeout(() => setTestResult(null), 3000);
      } else {
        setTestResult({ success: false, message: 'Failed to save configuration' });
      }
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
      // If there are unsaved changes, test with those
      const _testConfig = { ...llmConfig, ...editedConfig };
      
      // Save first if there are changes
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
          message: `✓ Connection successful! Response: "${data.response || 'OK'}"` 
        });
      } else {
        setTestResult({ 
          success: false, 
          message: `✗ Connection failed: ${data.error || 'Unknown error'}` 
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Network error';
      setTestResult({ 
        success: false, 
        message: `✗ Test failed: ${message || 'Network error'}` 
      });
    } finally {
      setTesting(false);
    }
  };

  const getCurrentValue = (field: keyof LLMConfig): string | number | undefined => {
    const edited = editedConfig[field];
    if (edited !== undefined) {
      return typeof edited === 'boolean' ? String(edited) : edited as string | number;
    }
    const current = llmConfig?.[field];
    return typeof current === 'boolean' ? String(current) : current as string | number | undefined;
  };

  const _llmSettingsCount = allSettings.filter(s => s.category === 'llm').length;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-primary" />
            System Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure LLM providers, API keys, and system-wide settings
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg"
            >
              <AlertCircle className="w-4 h-4" />
              Unsaved changes
            </motion.div>
          )}
          <Button
            onClick={handleSaveConfig}
            disabled={!hasChanges || saving}
            variant="primary"
            size="md"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">LLM Provider</p>
                  <p className="text-2xl font-bold text-primary capitalize mt-1">
                    {llmConfig?.provider || 'Not Set'}
                  </p>
                </div>
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Model</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {llmConfig?.model || 'N/A'}
                  </p>
                </div>
                <Server className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Settings</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {totalSettingsCount}
                  </p>
                </div>
                <Database className="w-8 h-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Test Result Banner */}
      {testResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
        >
          <Card className={testResult.success ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                {testResult.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                <p className={testResult.success ? 'text-green-700' : 'text-red-700'}>
                  {testResult.message}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* LLM Configuration */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Language Model Configuration
            </CardTitle>
            <CardDescription>
              Configure the AI provider and model used for dispute letter generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                LLM Provider
              </label>
              <select
                value={getCurrentValue('provider')}
                onChange={(e) => handleConfigChange('provider', e.target.value)}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="google">Google Gemini</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic Claude</option>
                <option value="zhipu">Zhipu AI (GLM)</option>
                <option value="custom">Custom Provider</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Select the AI provider for letter generation
              </p>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Model Name
              </label>
              {getCurrentValue('provider') === 'google' ? (
                <select
                  value={getCurrentValue('model')}
                  onChange={(e) => handleConfigChange('model', e.target.value)}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <optgroup label="Gemini 2.0 (Latest)">
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash (Recommended)</option>
                    <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash Experimental</option>
                    <option value="gemini-2.0-flash-lite">Gemini 2.0 Flash Lite (Fastest)</option>
                  </optgroup>
                  <optgroup label="Gemini 1.5 (Stable)">
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro (Best Quality)</option>
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
                    <option value="gemini-1.5-flash-8b">Gemini 1.5 Flash 8B (Efficient)</option>
                  </optgroup>
                  <optgroup label="Legacy">
                    <option value="gemini-1.0-pro">Gemini 1.0 Pro</option>
                  </optgroup>
                </select>
              ) : getCurrentValue('provider') === 'openai' ? (
                <select
                  value={getCurrentValue('model')}
                  onChange={(e) => handleConfigChange('model', e.target.value)}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <optgroup label="GPT-4o (Latest)">
                    <option value="gpt-4o">GPT-4o (Recommended)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini (Fast & Cheap)</option>
                  </optgroup>
                  <optgroup label="GPT-4 Turbo">
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-4-turbo-preview">GPT-4 Turbo Preview</option>
                  </optgroup>
                  <optgroup label="GPT-4">
                    <option value="gpt-4">GPT-4 (Most Capable)</option>
                    <option value="gpt-4-32k">GPT-4 32K Context</option>
                  </optgroup>
                  <optgroup label="GPT-3.5">
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Budget)</option>
                  </optgroup>
                </select>
              ) : getCurrentValue('provider') === 'anthropic' ? (
                <select
                  value={getCurrentValue('model')}
                  onChange={(e) => handleConfigChange('model', e.target.value)}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <optgroup label="Claude 3.5 (Latest)">
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet (Recommended)</option>
                    <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku (Fast)</option>
                  </optgroup>
                  <optgroup label="Claude 3 (Stable)">
                    <option value="claude-3-opus-20240229">Claude 3 Opus (Most Capable)</option>
                    <option value="claude-3-sonnet-20240229">Claude 3 Sonnet (Balanced)</option>
                    <option value="claude-3-haiku-20240307">Claude 3 Haiku (Fast)</option>
                  </optgroup>
                </select>
              ) : getCurrentValue('provider') === 'zhipu' ? (
                <div className="space-y-2">
                  <select
                    value={getCurrentValue('model')}
                    onChange={(e) => handleConfigChange('model', e.target.value)}
                    className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <optgroup label="GLM-4 (Standard Zhipu)">
                      <option value="glm-4-plus">GLM-4 Plus (Most Capable)</option>
                      <option value="glm-4-0520">GLM-4 0520</option>
                      <option value="glm-4">GLM-4 (Recommended)</option>
                      <option value="glm-4-air">GLM-4 Air (Fast)</option>
                      <option value="glm-4-airx">GLM-4 AirX (Faster)</option>
                      <option value="glm-4-long">GLM-4 Long (1M Context)</option>
                      <option value="glm-4-flash">GLM-4 Flash (Fastest)</option>
                    </optgroup>
                    <optgroup label="Z.ai Models (Recommended)">
                      <option value="glm-4.6">GLM-4.6 (Recommended for Z.ai)</option>
                    </optgroup>
                  </select>
                  {getCurrentValue('model') === 'custom' && (
                    <Input
                      type="text"
                      placeholder="Enter exact model name from Z.ai"
                      onChange={(e) => handleConfigChange('model', e.target.value)}
                    />
                  )}
                </div>
              ) : (
                <Input
                  type="text"
                  value={getCurrentValue('model')}
                  onChange={(e) => handleConfigChange('model', e.target.value)}
                  placeholder="model-name"
                />
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {getCurrentValue('provider') === 'google' 
                  ? 'Flash models are faster, Pro models are more capable.'
                  : getCurrentValue('provider') === 'openai'
                  ? 'GPT-4o recommended for best quality/speed balance. Mini for budget.'
                  : getCurrentValue('provider') === 'anthropic'
                  ? 'Claude 3.5 Sonnet recommended for dispute letters. Excellent at formal writing.'
                  : getCurrentValue('provider') === 'zhipu'
                  ? 'GLM-4 recommended. Flash is fastest, Plus is most capable.'
                  : 'Enter the model identifier for your provider'
                }
              </p>
            </div>

            {/* API Endpoint (for Zhipu/Custom) */}
            {(getCurrentValue('provider') === 'zhipu' || getCurrentValue('provider') === 'custom') && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  API Endpoint URL
                </label>
                <Input
                  type="text"
                  value={getCurrentValue('apiEndpoint') || ''}
                  onChange={(e) => handleConfigChange('apiEndpoint', e.target.value)}
                  placeholder={getCurrentValue('provider') === 'zhipu' 
                    ? 'https://api.z.ai/api/paas/v4' 
                    : 'https://api.example.com/v1'
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {getCurrentValue('provider') === 'zhipu'
                    ? 'For Z.ai use: https://api.z.ai/api/paas/v4'
                    : 'The base URL for the API (OpenAI-compatible format)'
                  }
                </p>
              </div>
            )}

            {/* API Key */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
                <Key className="w-4 h-4" />
                API Key
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showApiKey ? 'text' : 'password'}
                    value={getCurrentValue('apiKey') || ''}
                    onChange={(e) => handleConfigChange('apiKey', e.target.value)}
                    placeholder={llmConfig?.hasApiKey ? '••••••••••••••••' : 'Enter API key'}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {llmConfig?.hasApiKey 
                  ? 'API key is configured. Enter a new key to update it.'
                  : 'Falls back to GOOGLE_AI_API_KEY environment variable if not set'
                }
              </p>
            </div>

            {/* Advanced Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Temperature
                </label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={getCurrentValue('temperature')}
                  onChange={(e) => handleConfigChange('temperature', parseFloat(e.target.value))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Controls randomness (0 = deterministic, 1 = creative)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Max Tokens
                </label>
                <Input
                  type="number"
                  min="1024"
                  max="32000"
                  step="512"
                  value={getCurrentValue('maxTokens')}
                  onChange={(e) => handleConfigChange('maxTokens', parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Maximum length of generated content
                </p>
              </div>
            </div>

            {/* Test Connection Button */}
            <div className="pt-4 border-t">
              <Button
                onClick={handleTestConnection}
                disabled={testing}
                variant="outline"
                size="md"
                className="w-full"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <TestTube2 className="w-4 h-4 mr-2" />
                    Test LLM Connection
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* All Settings Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              All System Settings
            </CardTitle>
            <CardDescription>
              View all configuration settings stored in the database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Category</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Key</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Value</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {allSettings.map((setting) => (
                    <tr key={setting.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">
                          {setting.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-foreground">
                        {setting.settingKey}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {setting.isSecret ? (
                          <span className="flex items-center gap-2">
                            <Lock className="w-3 h-3" />
                            ••••••••••
                          </span>
                        ) : (
                          <span className="font-mono">
                            {typeof setting.parsedValue === 'object' 
                              ? JSON.stringify(setting.parsedValue) 
                              : String(setting.parsedValue || 'null')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-muted-foreground">
                        {setting.settingType}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

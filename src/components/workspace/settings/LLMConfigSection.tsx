'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Key, Eye, EyeOff, TestTube2, Loader2 } from 'lucide-react';
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

interface LLMConfigSectionProps {
  config: LLMConfig | null;
  onConfigChange: (field: keyof LLMConfig, value: string | number | boolean) => void;
  onSave: () => Promise<void>;
  onTest: () => Promise<void>;
  saving: boolean;
  testing: boolean;
  hasChanges: boolean;
}

export function LLMConfigSection({
  config,
  onConfigChange,
  onSave: _onSave,
  onTest,
  saving: _saving,
  testing,
  hasChanges: _hasChanges,
}: LLMConfigSectionProps) {
  const [showApiKey, setShowApiKey] = React.useState(false);

  const getCurrentValue = (field: keyof LLMConfig): string | number | undefined => {
    const current = config?.[field];
    return typeof current === 'boolean' ? String(current) : current as string | number | undefined;
  };

  return (
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
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              LLM Provider
            </label>
            <select
              value={getCurrentValue('provider')}
              onChange={(e) => onConfigChange('provider', e.target.value)}
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

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Model Name
            </label>
            {getCurrentValue('provider') === 'google' ? (
              <select
                value={getCurrentValue('model')}
                onChange={(e) => onConfigChange('model', e.target.value)}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <optgroup label="Gemini 2.5 (Latest)">
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Best Quality)</option>
                </optgroup>
                <optgroup label="Gemini 2.0 / 1.5 (Compatibility)">
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash (Fast)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                </optgroup>
              </select>
            ) : getCurrentValue('provider') === 'openai' ? (
              <select
                value={getCurrentValue('model')}
                onChange={(e) => onConfigChange('model', e.target.value)}
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
                onChange={(e) => onConfigChange('model', e.target.value)}
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
                  onChange={(e) => onConfigChange('model', e.target.value)}
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
                    onChange={(e) => onConfigChange('model', e.target.value)}
                  />
                )}
              </div>
            ) : (
              <Input
                type="text"
                value={getCurrentValue('model')}
                onChange={(e) => onConfigChange('model', e.target.value)}
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

          {(getCurrentValue('provider') === 'zhipu' || getCurrentValue('provider') === 'custom') && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                API Endpoint URL
              </label>
              <Input
                type="text"
                value={getCurrentValue('apiEndpoint') || ''}
                onChange={(e) => onConfigChange('apiEndpoint', e.target.value)}
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
                  onChange={(e) => onConfigChange('apiKey', e.target.value)}
                  placeholder={config?.hasApiKey ? '••••••••••••••••' : 'Enter API key'}
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
              {config?.hasApiKey
                ? 'API key is configured. Enter a new key to update it.'
                : 'Falls back to GOOGLE_AI_API_KEY environment variable if not set'
              }
            </p>
          </div>

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
                onChange={(e) => onConfigChange('temperature', parseFloat(e.target.value))}
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
                onChange={(e) => onConfigChange('maxTokens', parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum length of generated content
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button
              onClick={onTest}
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
  );
}

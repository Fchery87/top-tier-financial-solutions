'use client';

import { motion } from 'framer-motion';
import { Database, Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';

interface SystemSetting {
  id: string;
  settingKey: string;
  settingValue: string | null;
  settingType: string;
  category: string;
  description: string | null;
  isSecret: boolean;
  parsedValue: unknown;
}

interface SystemSettingsSectionProps {
  settings: SystemSetting[];
}

export function SystemSettingsSection({ settings }: SystemSettingsSectionProps) {
  return (
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
                {settings.map((setting) => (
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
  );
}

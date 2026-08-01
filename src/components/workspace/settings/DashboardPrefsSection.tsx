'use client';

import { motion } from 'framer-motion';
import { SettingsIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';

interface DashboardPreferences {
  defaultDensity: 'comfortable' | 'compact';
  showWorkQueue: boolean;
}

interface DashboardPrefsSectionProps {
  preferences: DashboardPreferences;
  onChange: (prefs: DashboardPreferences) => void;
}

export function DashboardPrefsSection({ preferences, onChange }: DashboardPrefsSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            Dashboard Preferences
          </CardTitle>
          <CardDescription>
            Control default layout and visibility for the Admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Default Dashboard Density
            </label>
            <select
              value={preferences.defaultDensity}
              onChange={(e) => {
                const value = e.target.value === 'compact' ? 'compact' : 'comfortable';
                onChange({ ...preferences, defaultDensity: value });
              }}
              className="w-full px-4 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Used when an admin has not chosen their own density preference on the dashboard.
            </p>
          </div>

          <div className="flex items-center justify-between py-2 border-t">
            <div>
              <p className="text-sm font-medium text-foreground">Show Work Queue widget</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Controls whether the Work Queue appears on the Admin dashboard.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-muted-foreground">Off</span>
              <input
                type="checkbox"
                checked={preferences.showWorkQueue}
                onChange={(e) => onChange({ ...preferences, showWorkQueue: e.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              <span className="text-xs text-muted-foreground">On</span>
            </label>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

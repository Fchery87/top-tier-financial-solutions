'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Zap, Loader2, Mail, Bell, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';

interface AutomationFailure {
  id: string;
  to_email: string;
  subject: string;
  trigger_type: string | null;
  error_message: string | null;
  created_at: string | null;
}

interface AutomationStats {
  emailsSentToday: number;
  emailsFailedToday: number;
  pendingEmails: number;
  automationsActive: number;
  recentFailures: AutomationFailure[];
}

export function AutomationStatus() {
  const [stats, setStats] = React.useState<AutomationStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchAutomationStats() {
      try {
        const response = await fetch('/api/admin/automation');
        if (response.ok) {
          const data: AutomationStats = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching automation stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAutomationStats();
  }, []);

  const formatTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <Zap className="w-5 h-5 text-secondary" />
            Automations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const automationItems = [
    {
      icon: Mail,
      label: 'Emails sent today',
      value: stats?.emailsSentToday || 0,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      status: 'info',
    },
    {
      icon: Bell,
      label: 'Emails queued',
      value: stats?.pendingEmails || 0,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      status: stats?.pendingEmails ? 'pending' : 'info',
    },
    {
      icon: AlertTriangle,
      label: 'Failures (24h)',
      value: stats?.emailsFailedToday || 0,
      color: stats && stats.emailsFailedToday > 0 ? 'text-red-500' : 'text-muted-foreground',
      bgColor: stats && stats.emailsFailedToday > 0 ? 'bg-red-500/10' : 'bg-muted/50',
      status: stats && stats.emailsFailedToday > 0 ? 'issue' : 'info',
    },
  ];

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-serif flex items-center gap-2">
              <Zap className="w-5 h-5 text-secondary" />
              Today&apos;s Automations
            </CardTitle>
            <CardDescription>
              {stats?.automationsActive || 0} active workflows
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10">
            <span className={`w-2 h-2 rounded-full ${
              stats && stats.emailsFailedToday > 0 ? 'bg-orange-500 animate-pulse' : 'bg-green-500 animate-pulse'
            }`} />
            <span className={`text-xs font-medium ${
              stats && stats.emailsFailedToday > 0 ? 'text-orange-500' : 'text-green-500'
            }`}>
              {stats && stats.emailsFailedToday > 0 ? 'Attention needed' : 'Active'}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {automationItems.map((item, index) => {
            const Icon = item.icon;
            
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3"
              >
                <div className={`p-2 rounded-lg ${item.bgColor}`}>
                  {item.status === 'issue' ? (
                    <AlertTriangle className={`w-4 h-4 ${item.color}`} />
                  ) : item.status === 'pending' ? (
                    <Clock className={`w-4 h-4 ${item.color}`} />
                  ) : (
                    <Icon className={`w-4 h-4 ${item.color}`} />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm">{item.label}</p>
                </div>
                <span className={`text-sm font-semibold ${item.color}`}>
                  {item.value}
                </span>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-border/50 space-y-2">
          {stats && stats.recentFailures.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Recent failures
              </p>
              {stats.recentFailures.map((f) => (
                <div key={f.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate max-w-[180px]">{f.subject || 'Email send failed'}</span>
                  <span className="whitespace-nowrap ml-2">{formatTimeAgo(f.created_at)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last check: just now</span>
            <span className="flex items-center gap-1">
              {stats && stats.emailsFailedToday > 0 ? (
                <AlertTriangle className="w-3 h-3 text-orange-500" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-green-500" />
              )}
              {stats && stats.emailsFailedToday > 0
                ? 'Some automations are failing'
                : 'All systems operational'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

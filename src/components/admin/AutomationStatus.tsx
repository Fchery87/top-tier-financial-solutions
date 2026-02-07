'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Zap, Loader2, Mail, Bell, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

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
  disputeEscalations: {
    eligibleNow: number;
    escalatedLast24h: number;
    lastRunAt: string | null;
    lastRunSuccess: boolean | null;
    lastRunDryRun: boolean | null;
    lastRunChecked: number | null;
    lastRunEscalated: number | null;
    lastRunWouldEscalate: number | null;
    lastRunSkipped: number | null;
    lastRunError: string | null;
    health: 'healthy' | 'warning' | 'error' | 'disabled';
  };
  recentFailures: AutomationFailure[];
}

export function AutomationStatus() {
  const [stats, setStats] = React.useState<AutomationStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [runLoading, setRunLoading] = React.useState<'dry' | 'live' | null>(null);
  const [runMessage, setRunMessage] = React.useState<string | null>(null);

  const fetchAutomationStats = React.useCallback(async () => {
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
  }, []);

  React.useEffect(() => {
    fetchAutomationStats();
  }, [fetchAutomationStats]);

  const runEscalationAutomation = React.useCallback(async (dryRun: boolean) => {
    setRunLoading(dryRun ? 'dry' : 'live');
    setRunMessage(null);
    try {
      const response = await fetch('/api/admin/automation/dispute-escalations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setRunMessage(data?.error || 'Failed to run escalation automation.');
        return;
      }

      const modeLabel = dryRun ? 'Dry run' : 'Live run';
      setRunMessage(
        `${modeLabel} complete: checked ${data.checked ?? 0}, escalated ${data.escalated ?? 0}, would escalate ${data.would_escalate ?? 0}.`
      );
      await fetchAutomationStats();
    } catch {
      setRunMessage('Failed to run escalation automation.');
    } finally {
      setRunLoading(null);
    }
  }, [fetchAutomationStats]);

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

  const disputeEscalations = stats?.disputeEscalations ?? {
    eligibleNow: 0,
    escalatedLast24h: 0,
    lastRunAt: null,
    lastRunSuccess: null,
    lastRunDryRun: null,
    lastRunChecked: null,
    lastRunEscalated: null,
    lastRunWouldEscalate: null,
    lastRunSkipped: null,
    lastRunError: null,
    health: 'warning' as const,
  };
  const escalationHealth = disputeEscalations.health;
  const escalationHealthLabel =
    escalationHealth === 'healthy'
      ? 'Escalation automation healthy'
      : escalationHealth === 'error'
        ? 'Escalation automation failed'
        : escalationHealth === 'disabled'
          ? 'Escalation automation disabled'
          : 'Escalation automation needs attention';
  const escalationHealthColor =
    escalationHealth === 'healthy'
      ? 'text-green-500'
      : escalationHealth === 'error'
        ? 'text-red-500'
        : escalationHealth === 'disabled'
          ? 'text-muted-foreground'
          : 'text-orange-500';

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
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!!runLoading}
              onClick={() => runEscalationAutomation(true)}
            >
              {runLoading === 'dry' ? 'Running Dry-Run...' : 'Run Dry-Run'}
            </Button>
            <Button
              size="sm"
              disabled={!!runLoading}
              onClick={() => runEscalationAutomation(false)}
            >
              {runLoading === 'live' ? 'Running Live...' : 'Run Live'}
            </Button>
          </div>
          {runMessage ? (
            <p className="text-xs text-muted-foreground">{runMessage}</p>
          ) : null}

          <div className="space-y-1">
            <p className={`text-xs font-medium flex items-center gap-1 ${escalationHealthColor}`}>
              {escalationHealth === 'healthy' ? (
                <CheckCircle2 className="w-3 h-3" />
              ) : escalationHealth === 'error' ? (
                <AlertTriangle className="w-3 h-3" />
              ) : (
                <Clock className="w-3 h-3" />
              )}
              {escalationHealthLabel}
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>Escalations eligible now</span>
              <span className="text-right font-medium">{disputeEscalations.eligibleNow || 0}</span>
              <span>Escalated in last 24h</span>
              <span className="text-right font-medium">{disputeEscalations.escalatedLast24h || 0}</span>
              <span>Escalation last run</span>
              <span className="text-right font-medium">
                {disputeEscalations.lastRunAt
                  ? formatTimeAgo(disputeEscalations.lastRunAt)
                  : 'Never'}
              </span>
            </div>
            {disputeEscalations.lastRunDryRun ? (
              <p className="text-xs text-orange-500">Last run was dry-run mode.</p>
            ) : null}
            {disputeEscalations.lastRunError ? (
              <p className="text-xs text-red-500 truncate">
                Last escalation error: {disputeEscalations.lastRunError}
              </p>
            ) : null}
          </div>

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

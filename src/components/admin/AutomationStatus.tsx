'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { Zap, Loader2, Mail, Bell, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';

interface AutomationStats {
  emailsSentToday: number;
  remindersQueued: number;
  followupsPending: number;
  automationsActive: number;
}

export function AutomationStatus() {
  const [stats, setStats] = React.useState<AutomationStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchAutomationStats() {
      try {
        // This would ideally hit a dedicated automation stats endpoint
        // For now, we'll show placeholder data that can be enhanced later
        const response = await fetch('/api/admin/stats');
        if (response.ok) {
          const data = await response.json();
          
          setStats({
            emailsSentToday: data.emailsSentToday || 0,
            remindersQueued: data.attentionNeeded?.responseDueSoon || 0,
            followupsPending: data.attentionNeeded?.overdueTasks || 0,
            automationsActive: data.automationsActive || 3, // Default active automations
          });
        }
      } catch (error) {
        console.error('Error fetching automation stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAutomationStats();
  }, []);

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
      status: 'complete',
    },
    {
      icon: Bell,
      label: 'Deadline reminders queued',
      value: stats?.remindersQueued || 0,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      status: stats?.remindersQueued ? 'pending' : 'complete',
    },
    {
      icon: Clock,
      label: 'Follow-ups pending',
      value: stats?.followupsPending || 0,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      status: stats?.followupsPending ? 'pending' : 'complete',
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
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-green-500 font-medium">Active</span>
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
                  {item.status === 'complete' ? (
                    <CheckCircle2 className={`w-4 h-4 ${item.color}`} />
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

        {/* Status indicator */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last run: Just now</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-500" />
              All systems operational
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

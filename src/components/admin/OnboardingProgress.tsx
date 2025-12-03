'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { UserPlus, FileText, FileSignature, Scale, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';

interface OnboardingStats {
  reportUploaded: { count: number; total: number };
  reportAnalyzed: { count: number; total: number };
  agreementSigned: { count: number; total: number };
  firstDispute: { count: number; total: number };
  newClientsThisWeek: number;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  
  return (
    <div className="h-2 bg-muted rounded-full overflow-hidden">
      <motion.div
        className={`h-full ${color} rounded-full`}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}

export function OnboardingProgress() {
  const [stats, setStats] = React.useState<OnboardingStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/admin/stats');
        if (response.ok) {
          const data = await response.json();
          
          // Calculate onboarding stats from the response
          // This uses existing data to calculate funnel metrics
          const newClientsThisWeek = data.newClientsThisWeek || 0;
          const totalNew = Math.max(newClientsThisWeek, 1);
          
          setStats({
            reportUploaded: { 
              count: data.clientsWithReports || 0, 
              total: data.activeClients || totalNew 
            },
            reportAnalyzed: { 
              count: data.clientsWithAnalysis || 0, 
              total: data.activeClients || totalNew 
            },
            agreementSigned: { 
              count: data.signedAgreements || 0, 
              total: data.activeClients || totalNew 
            },
            firstDispute: { 
              count: data.clientsWithDisputes || 0, 
              total: data.activeClients || totalNew 
            },
            newClientsThisWeek,
          });
        }
      } catch (error) {
        console.error('Error fetching onboarding stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-secondary" />
            Onboarding Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const stages = [
    { 
      icon: FileText, 
      label: 'Report Uploaded', 
      data: stats?.reportUploaded,
      color: 'bg-blue-500'
    },
    { 
      icon: CheckCircle2, 
      label: 'Report Analyzed', 
      data: stats?.reportAnalyzed,
      color: 'bg-purple-500'
    },
    { 
      icon: FileSignature, 
      label: 'Agreement Signed', 
      data: stats?.agreementSigned,
      color: 'bg-orange-500'
    },
    { 
      icon: Scale, 
      label: 'First Dispute', 
      data: stats?.firstDispute,
      color: 'bg-green-500'
    },
  ];

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-serif flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-secondary" />
              Onboarding Progress
            </CardTitle>
            <CardDescription>
              Client funnel status
            </CardDescription>
          </div>
          {stats?.newClientsThisWeek !== undefined && stats.newClientsThisWeek > 0 && (
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-500">
              +{stats.newClientsThisWeek} this week
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const count = stage.data?.count || 0;
            const total = stage.data?.total || 0;
            
            return (
              <motion.div
                key={stage.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md ${stage.color}/10`}>
                      <Icon className={`w-3.5 h-3.5 ${stage.color.replace('bg-', 'text-')}`} />
                    </div>
                    <span className="text-sm">{stage.label}</span>
                  </div>
                  <span className="text-sm font-medium">
                    {count}/{total}
                  </span>
                </div>
                <ProgressBar value={count} max={total} color={stage.color} />
              </motion.div>
            );
          })}
        </div>

        {/* Empty state */}
        {stats && stages.every(s => (s.data?.total || 0) === 0) && (
          <div className="text-center py-6 text-muted-foreground">
            <UserPlus className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No clients yet</p>
            <p className="text-xs mt-1">Convert leads to start tracking</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

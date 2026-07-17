'use client';

import * as React from 'react';
import Link from 'next/link';
import { Scale, Clock, ArrowRight, BarChart3, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ClientPipeline } from '@/components/admin/ClientPipeline';

interface DashboardStats {
  activeClients: number;
  pendingReports: number;
  disputesSent: number;
  disputesPending: number;
  totalNegativeItems: number;
  avgCreditScore: number;
  successRate: number;
  disputePipeline: {
    round1: number;
    round2: number;
    round3: number;
    awaiting: number;
  };
  attentionNeeded: {
    pendingReports: number;
    pendingAgreements: number;
    overdueTasks: number;
    responseDueSoon: number;
    overdueResponses: number;
  };
  successByBureau: {
    transunion: { total: number; deleted: number; rate: number };
    experian: { total: number; deleted: number; rate: number };
    equifax: { total: number; deleted: number; rate: number };
  };
  itemsRemovedThisMonth: number;
  recentActivity: Array<{
    type: 'dispute' | 'report';
    id: string;
    clientName: string;
    action: string;
    detail: string;
    timestamp: string;
  }>;
  newLeads: number;
}

interface PipelineTabProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export function PipelineTab({ stats, loading }: PipelineTabProps) {
  return (
    <div className="space-y-6">
      <ClientPipeline />

      <Card className="bg-card border border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Scale className="h-4 w-4 text-secondary" />
                Dispute Pipeline
              </CardTitle>
              <CardDescription>Active disputes by round</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/disputes/wizard">
                View All <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              <Link href="/admin/disputes?round=1&status=sent" className="block group">
                <div className="text-center p-4 rounded-xl bg-muted/50 border border-border/50 group-hover:border-secondary/50 group-hover:bg-muted transition-all cursor-pointer">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-secondary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-secondary">R1</span>
                  </div>
                  <p className="text-2xl font-bold">{stats?.disputePipeline.round1 ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Round 1</p>
                </div>
              </Link>
              <Link href="/admin/disputes?round=2&status=sent" className="block group">
                <div className="text-center p-4 rounded-xl bg-muted/50 border border-border/50 group-hover:border-secondary/50 group-hover:bg-muted transition-all cursor-pointer">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-secondary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-secondary">R2</span>
                  </div>
                  <p className="text-2xl font-bold">{stats?.disputePipeline.round2 ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Round 2</p>
                </div>
              </Link>
              <Link href="/admin/disputes?round=3&status=sent" className="block group">
                <div className="text-center p-4 rounded-xl bg-muted/50 border border-border/50 group-hover:border-secondary/50 group-hover:bg-muted transition-all cursor-pointer">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-warning/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-warning">R3</span>
                  </div>
                  <p className="text-2xl font-bold">{stats?.disputePipeline.round3 ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Round 3</p>
                </div>
              </Link>
              <Link href="/admin/disputes?awaiting_response=true" className="block group">
                <div className="text-center p-4 rounded-xl bg-muted/50 border border-border/50 group-hover:border-secondary/50 group-hover:bg-muted transition-all cursor-pointer">
                  <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-warning/10 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-warning" />
                  </div>
                  <p className="text-2xl font-bold">{stats?.disputePipeline.awaiting ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Awaiting</p>
                </div>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <BarChart3 className="h-4 w-4 text-secondary" />
            Success Rate by Bureau
          </CardTitle>
          <CardDescription>Deletion rate across credit bureaus</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {(['transunion', 'experian', 'equifax'] as const).map((bureauKey) => {
                const data = stats?.successByBureau?.[bureauKey];
                const rate = data?.rate ?? 0;
                const label = bureauKey;
                return (
                  <Link
                    key={bureauKey}
                    href={`/admin/disputes?bureau=${bureauKey}&outcome=deleted`}
                    className="block group"
                  >
                    <div className="text-center p-4 rounded-xl bg-muted/50 border border-border/50 group-hover:border-secondary/50 group-hover:bg-muted transition-all cursor-pointer">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
                      <div className="relative w-16 h-16 mx-auto mb-2">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none" className="text-muted/30" />
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke="currentColor"
                            strokeWidth="6"
                            fill="none"
                            strokeDasharray={`${rate * 1.76} 176`}
                            className="text-up"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                          {rate}%
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {data?.deleted ?? 0} of {data?.total ?? 0} deleted
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

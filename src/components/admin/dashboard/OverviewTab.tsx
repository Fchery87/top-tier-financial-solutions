'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Users,
  Scale,
  CheckCircle2,
  ArrowRight,
  FileText,
  FileWarning,
  FileSignature,
  ListTodo,
  AlertCircle,
  Activity,
  BarChart3,
  Target,
  Clock,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { CalendarWidget } from '@/components/admin/CalendarWidget';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricTile } from '@/components/ui/MetricTile';
import { ScoreBadge } from '@/components/ui/ScoreBadge';

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

interface OverviewTabProps {
  stats: DashboardStats | null;
  loading: boolean;
  totalAttention: number;
  formatTimeAgo: (timestamp: string) => string;
  metricCardPadding: string;
  metricGridGap: string;
}

export function OverviewTab({
  stats,
  loading,
  totalAttention,
  formatTimeAgo,
  metricCardPadding,
  metricGridGap,
}: OverviewTabProps) {
  const compact = metricCardPadding.includes('p-3');

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className={`grid grid-cols-2 lg:grid-cols-4 ${metricGridGap}`}>
          <MetricTile
            label="Active Clients"
            value={stats?.activeClients ?? 0}
            icon={Users}
            href="/admin/clients?status=active"
            loading={loading}
            compact={compact}
          />
          <MetricTile
            label="Open Disputes"
            value={stats?.disputesPending ?? 0}
            icon={Scale}
            href="/admin/disputes?awaiting_response=true"
            loading={loading}
            compact={compact}
          />
          <MetricTile
            label="Negative Tradelines"
            value={stats?.totalNegativeItems ?? 0}
            icon={FileWarning}
            href="/admin/disputes?status=draft"
            loading={loading}
            compact={compact}
          />
          <MetricTile
            label="Items Removed (30d)"
            value={stats?.itemsRemovedThisMonth ?? 0}
            icon={CheckCircle2}
            accent="emerald"
            href="/admin/results?range=month"
            loading={loading}
            compact={compact}
          />
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${metricGridGap}`}>
          <MetricTile
            label="Average Credit Score"
            value={<ScoreBadge score={stats?.avgCreditScore || null} variant="plain" size="lg" showLabel />}
            icon={BarChart3}
            href="/admin/results?range=all"
            loading={loading}
            compact={compact}
          />
          <MetricTile
            label="Dispute Success Rate"
            value={`${stats?.successRate ?? 0}%`}
            icon={Target}
            accent="emerald"
            href="/admin/results?range=all"
            loading={loading}
            compact={compact}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className={`bg-card shadow-sm ${totalAttention > 0 ? 'border-t-2 border-t-warning' : ''}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <AlertCircle className={`w-5 h-5 ${totalAttention > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
                Today&apos;s Work
                {totalAttention > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-warning/10 text-warning">
                    {totalAttention}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : totalAttention === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="All caught up!"
                  description="No items need attention."
                  className="py-6"
                />
              ) : (
                <div className="space-y-3">
                  {(stats?.attentionNeeded?.pendingReports ?? 0) > 0 && (
                    <Link href="/admin/clients" className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center">
                          <FileText className="h-[18px] w-[18px] text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Reports to Analyze</p>
                          <p className="text-xs text-muted-foreground">Credit reports pending analysis</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xl font-semibold tabular-nums">{stats?.attentionNeeded?.pendingReports}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-secondary transition-colors" />
                      </div>
                    </Link>
                  )}
                  {(stats?.attentionNeeded?.pendingAgreements ?? 0) > 0 && (
                    <Link href="/admin/agreements" className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center">
                          <FileSignature className="h-[18px] w-[18px] text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Pending Agreements</p>
                          <p className="text-xs text-muted-foreground">Awaiting client signature</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xl font-semibold tabular-nums">{stats?.attentionNeeded?.pendingAgreements}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-secondary transition-colors" />
                      </div>
                    </Link>
                  )}
                  {(stats?.attentionNeeded?.overdueTasks ?? 0) > 0 && (
                    <Link href="/admin/tasks" className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center">
                          <ListTodo className="h-[18px] w-[18px] text-destructive" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Overdue Tasks</p>
                          <p className="text-xs text-muted-foreground">Tasks past due date</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xl font-semibold tabular-nums">{stats?.attentionNeeded?.overdueTasks}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-secondary transition-colors" />
                      </div>
                    </Link>
                  )}
                  {(stats?.attentionNeeded?.responseDueSoon ?? 0) > 0 && (
                    <Link href="/admin/disputes?awaiting_response=true" className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center">
                          <Clock className="h-[18px] w-[18px] text-warning" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Response Due Soon</p>
                          <p className="text-xs text-muted-foreground">Bureau responses due within 7 days</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xl font-semibold tabular-nums">{stats?.attentionNeeded?.responseDueSoon}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-secondary transition-colors" />
                      </div>
                    </Link>
                  )}
                  {(stats?.attentionNeeded?.overdueResponses ?? 0) > 0 && (
                    <Link href="/admin/disputes?overdue=true" className="flex items-center justify-between p-3 rounded-lg bg-destructive/[0.04] hover:bg-destructive/[0.08] transition-colors group border border-destructive/30">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center">
                          <AlertCircle className="h-[18px] w-[18px] text-destructive" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-destructive">Overdue Responses</p>
                          <p className="text-xs text-muted-foreground">Bureaus past 30-day deadline</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xl font-semibold tabular-nums text-destructive">{stats?.attentionNeeded?.overdueResponses}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-secondary transition-colors" />
                      </div>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <CalendarWidget />

          <Card className="bg-card border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Activity className="w-5 h-5 text-secondary" />
                Recent Activity
              </CardTitle>
              <CardDescription>Latest updates across all clients</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : !stats?.recentActivity || stats.recentActivity.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No recent activity"
                  description="Upload a credit report to get started"
                  className="py-8"
                  action={{ label: 'Upload Report', href: '/admin/clients' }}
                />
              ) : (
                <div className="space-y-1">
                  {stats.recentActivity.map((item) => (
                    <div key={`${item.type}-${item.id}`} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="mt-0.5 flex h-7 w-7 items-center justify-center">
                        {item.type === 'dispute' ? (
                          <Scale className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.clientName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.action}
                          {item.detail && <span className="ml-1 text-secondary">{item.detail}</span>}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {item.timestamp ? formatTimeAgo(item.timestamp) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

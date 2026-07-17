'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Users,
  Scale,
  CheckCircle2,
  ArrowUpRight,
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
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { CalendarWidget } from '@/components/admin/CalendarWidget';
import { EmptyState } from '@/components/ui/EmptyState';
import { MetricTile } from '@/components/ui/MetricTile';
import { ScoreBadge } from '@/components/ui/ScoreBadge';
import { cn } from '@/lib/utils';

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

interface QueueRow {
  key: keyof DashboardStats['attentionNeeded'];
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  /** 'urgent' rows read in brick red; 'warm' in the warning tone. */
  severity?: 'default' | 'warm' | 'urgent';
}

const queueRows: QueueRow[] = [
  {
    key: 'overdueResponses',
    icon: AlertCircle,
    title: 'Overdue Responses',
    description: 'Bureaus past the 30-day deadline',
    href: '/admin/disputes?overdue=true',
    severity: 'urgent',
  },
  {
    key: 'responseDueSoon',
    icon: Clock,
    title: 'Response Due Soon',
    description: 'Bureau responses due within 7 days',
    href: '/admin/disputes?awaiting_response=true',
    severity: 'warm',
  },
  {
    key: 'overdueTasks',
    icon: ListTodo,
    title: 'Overdue Tasks',
    description: 'Tasks past their due date',
    href: '/admin/tasks',
    severity: 'urgent',
  },
  {
    key: 'pendingReports',
    icon: FileText,
    title: 'Reports to Analyze',
    description: 'Credit reports pending analysis',
    href: '/admin/clients',
  },
  {
    key: 'pendingAgreements',
    icon: FileSignature,
    title: 'Pending Agreements',
    description: 'Awaiting client signature',
    href: '/admin/agreements',
  },
];

function CardLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <CardTitle className="flex items-center gap-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
      {children}
      {count != null && count > 0 && (
        <span className="rounded bg-warning/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums tracking-normal text-warning">
          {count}
        </span>
      )}
    </CardTitle>
  );
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="border-b pb-4">
              <CardLabel count={totalAttention}>Today&apos;s Work</CardLabel>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : totalAttention === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="All caught up!"
                  description="No items need attention."
                  className="py-8"
                />
              ) : (
                <div className="divide-y divide-border/70">
                  {queueRows.map((row) => {
                    const count = stats?.attentionNeeded?.[row.key] ?? 0;
                    if (count <= 0) return null;
                    const Icon = row.icon;
                    return (
                      <Link
                        key={row.key}
                        href={row.href}
                        className="group flex items-center justify-between gap-4 px-4 py-3 transition-colors duration-[120ms] ease-[var(--ease-out)] hover:bg-muted/40"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0',
                              row.severity === 'urgent'
                                ? 'text-destructive'
                                : row.severity === 'warm'
                                  ? 'text-warning'
                                  : 'text-muted-foreground',
                            )}
                            strokeWidth={1.75}
                          />
                          <div className="min-w-0">
                            <p
                              className={cn(
                                'truncate text-[13px] font-medium',
                                row.severity === 'urgent' ? 'text-destructive' : 'text-foreground',
                              )}
                            >
                              {row.title}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{row.description}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2.5">
                          <span
                            className={cn(
                              'font-mono text-lg font-semibold tabular-nums',
                              row.severity === 'urgent' ? 'text-destructive' : 'text-foreground',
                            )}
                          >
                            {count}
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/50 transition-colors duration-[120ms] group-hover:text-secondary" strokeWidth={1.75} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <CalendarWidget />

          <Card>
            <CardHeader className="border-b pb-4">
              <CardLabel>Recent Activity</CardLabel>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
                <div className="divide-y divide-border/70">
                  {stats.recentActivity.map((item) => (
                    <div key={`${item.type}-${item.id}`} className="flex items-start gap-3 px-4 py-2.5 transition-colors duration-[120ms] ease-[var(--ease-out)] hover:bg-muted/40">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                        {item.type === 'dispute' ? (
                          <Scale className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
                        ) : (
                          <FileText className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium">{item.clientName}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.action}
                          {item.detail && <span className="ml-1 text-secondary">{item.detail}</span>}
                        </p>
                      </div>
                      <span className="whitespace-nowrap font-mono text-[10px] tabular-nums text-muted-foreground">
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

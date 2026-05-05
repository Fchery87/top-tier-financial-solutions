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
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${metricGridGap}`}>
          <Link href="/admin/clients?status=active" className="block">
            <Card className="bg-card shadow-sm hover:border-secondary/30 transition-all cursor-pointer">
              <CardContent className={metricCardPadding}>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Users className="w-4 h-4 text-blue-500" />
                  </div>
                </div>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <p className="text-2xl font-bold text-foreground">{stats?.activeClients ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Active Clients</p>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/disputes?awaiting_response=true" className="block">
            <Card className="bg-card shadow-sm hover:border-secondary/30 transition-all cursor-pointer">
              <CardContent className={metricCardPadding}>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <Scale className="w-4 h-4 text-purple-500" />
                  </div>
                </div>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <p className="text-2xl font-bold text-foreground">{stats?.disputesPending ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Open Disputes</p>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/disputes?status=draft" className="block">
            <Card className="bg-card shadow-sm hover:border-secondary/30 transition-all cursor-pointer">
              <CardContent className={metricCardPadding}>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <FileWarning className="w-4 h-4 text-orange-500" />
                  </div>
                </div>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <p className="text-2xl font-bold text-foreground">{stats?.totalNegativeItems ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Negative Tradelines</p>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/results?range=month" className="block">
            <Card className="bg-card shadow-sm hover:border-secondary/30 transition-all cursor-pointer">
              <CardContent className={metricCardPadding}>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                </div>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <p className="text-2xl font-bold text-foreground">{stats?.itemsRemovedThisMonth ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Items Removed (30d)</p>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 ${metricGridGap}`}>
          <Link href="/admin/results?range=all" className="block">
            <Card className="bg-card shadow-sm hover:border-secondary/30 transition-all cursor-pointer">
              <CardContent className={metricCardPadding}>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <BarChart3 className="w-4 h-4 text-cyan-500" />
                  </div>
                </div>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <p className="text-2xl font-bold text-foreground">{stats?.avgCreditScore || '\u2014'}</p>
                    <p className="text-xs text-muted-foreground">Average Credit Score</p>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/results?range=all" className="block">
            <Card className="bg-card shadow-sm hover:border-secondary/30 transition-all cursor-pointer">
              <CardContent className={metricCardPadding}>
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Target className="w-4 h-4 text-green-500" />
                  </div>
                </div>
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <p className="text-2xl font-bold text-foreground">{stats?.successRate ?? 0}%</p>
                    <p className="text-xs text-muted-foreground">Dispute Success Rate</p>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className={`bg-card shadow-sm ${totalAttention > 0 ? 'border-t-4 border-t-orange-500' : ''}`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-serif flex items-center gap-2">
                <AlertCircle className={`w-5 h-5 ${totalAttention > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                Today&apos;s Work
                {totalAttention > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-orange-500/10 text-orange-500">
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
                        <div className="p-2 rounded-lg bg-orange-500/10">
                          <FileText className="w-4 h-4 text-orange-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Reports to Analyze</p>
                          <p className="text-xs text-muted-foreground">Credit reports pending analysis</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{stats?.attentionNeeded?.pendingReports}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-secondary transition-colors" />
                      </div>
                    </Link>
                  )}
                  {(stats?.attentionNeeded?.pendingAgreements ?? 0) > 0 && (
                    <Link href="/admin/agreements" className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                          <FileSignature className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Pending Agreements</p>
                          <p className="text-xs text-muted-foreground">Awaiting client signature</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{stats?.attentionNeeded?.pendingAgreements}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-secondary transition-colors" />
                      </div>
                    </Link>
                  )}
                  {(stats?.attentionNeeded?.overdueTasks ?? 0) > 0 && (
                    <Link href="/admin/tasks" className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-500/10">
                          <ListTodo className="w-4 h-4 text-red-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Overdue Tasks</p>
                          <p className="text-xs text-muted-foreground">Tasks past due date</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{stats?.attentionNeeded?.overdueTasks}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-secondary transition-colors" />
                      </div>
                    </Link>
                  )}
                  {(stats?.attentionNeeded?.responseDueSoon ?? 0) > 0 && (
                    <Link href="/admin/disputes?awaiting_response=true" className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-yellow-500/10">
                          <Clock className="w-4 h-4 text-yellow-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Response Due Soon</p>
                          <p className="text-xs text-muted-foreground">Bureau responses due within 7 days</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{stats?.attentionNeeded?.responseDueSoon}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-secondary transition-colors" />
                      </div>
                    </Link>
                  )}
                  {(stats?.attentionNeeded?.overdueResponses ?? 0) > 0 && (
                    <Link href="/admin/disputes?overdue=true" className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group border border-red-500/30">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-500/10">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-red-500">Overdue Responses</p>
                          <p className="text-xs text-muted-foreground">Bureaus past 30-day deadline</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-red-500">{stats?.attentionNeeded?.overdueResponses}</span>
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
              <CardTitle className="text-lg font-serif flex items-center gap-2">
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
                      <div className={`mt-0.5 p-1.5 rounded-full ${
                        item.type === 'dispute' ? 'bg-purple-500/10' : 'bg-blue-500/10'
                      }`}>
                        {item.type === 'dispute' ? (
                          <Scale className="w-3 h-3 text-purple-500" />
                        ) : (
                          <FileText className="w-3 h-3 text-blue-500" />
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

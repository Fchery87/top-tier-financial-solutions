'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Users, 
  FileText, 
  Scale,
  TrendingUp,
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  FileWarning,
  FileSignature,
  ListTodo,
  Activity,
  BarChart3,
  Target,
  Zap,
  Trophy
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ClientPipeline } from '@/components/admin/ClientPipeline';
import { ScoreTrendChart } from '@/components/admin/ScoreTrendChart';
import { OnboardingProgress } from '@/components/admin/OnboardingProgress';
import { CalendarWidget } from '@/components/admin/CalendarWidget';
import { TeamActivity } from '@/components/admin/TeamActivity';
import { GoalTracker } from '@/components/admin/GoalTracker';
import { AutomationStatus } from '@/components/admin/AutomationStatus';

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
  // Legacy
  newLeads: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [density, setDensity] = React.useState<'comfortable' | 'compact'>('comfortable');

  React.useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/admin/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const totalAttention = stats ? 
    (stats.attentionNeeded?.pendingReports ?? 0) + 
    (stats.attentionNeeded?.pendingAgreements ?? 0) + 
    (stats.attentionNeeded?.overdueTasks ?? 0) +
    (stats.attentionNeeded?.responseDueSoon ?? 0) +
    (stats.attentionNeeded?.overdueResponses ?? 0) : 0;

  const verticalSpacing = density === 'compact' ? 'space-y-4' : 'space-y-6';
  const metricCardPadding = density === 'compact' ? 'p-3' : 'p-4';
  const metricGridGap = density === 'compact' ? 'gap-3' : 'gap-4';
  const isCompact = density === 'compact';

  return (
    <div className={verticalSpacing}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-serif font-bold text-foreground"
          >
            Credit Repair Command Center
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Monitor cases, track disputes, and manage your credit repair workflow in one command center.
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3"
        >
          <div className="hidden md:flex items-center gap-1 rounded-full bg-muted px-1 py-0.5 text-[11px] text-muted-foreground">
            <span className="px-2">Density</span>
            <button
              type="button"
              onClick={() => setDensity('comfortable')}
              className={
                `px-2 py-0.5 rounded-full transition-colors ` +
                (isCompact ? 'text-muted-foreground' : 'bg-background text-foreground shadow-sm')
              }
            >
              Comfort
            </button>
            <button
              type="button"
              onClick={() => setDensity('compact')}
              className={
                `px-2 py-0.5 rounded-full transition-colors ` +
                (isCompact ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')
              }
            >
              Compact
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href="/admin/disputes/wizard">
                <Zap className="w-4 h-4 mr-2" />
                New Dispute
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/admin/clients">
                <Users className="w-4 h-4 mr-2" />
                View Clients
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Primary Metrics */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-4"
      >
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${metricGridGap}`}>
          <Link href="/admin/clients?status=active" className="block">
            <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/30 transition-all cursor-pointer">
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
            <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/30 transition-all cursor-pointer">
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
            <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/30 transition-all cursor-pointer">
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
            <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/30 transition-all cursor-pointer">
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
            <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/30 transition-all cursor-pointer">
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
                    <p className="text-2xl font-bold text-foreground">{stats?.avgCreditScore || '—'}</p>
                    <p className="text-xs text-muted-foreground">Average Credit Score</p>
                  </>
                )}
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/results?range=all" className="block">
            <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/30 transition-all cursor-pointer">
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
      </motion.div>

      {/* Client Pipeline - Kanban Board */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <ClientPipeline />
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Dispute Pipeline & Attention */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dispute Pipeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-serif flex items-center gap-2">
                      <Scale className="w-5 h-5 text-secondary" />
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
                    <div className="text-center p-4 rounded-xl bg-muted/50 border border-border/50">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-blue-500">R1</span>
                      </div>
                      <p className="text-2xl font-bold">{stats?.disputePipeline.round1 ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Round 1</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-muted/50 border border-border/50">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-purple-500/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-purple-500">R2</span>
                      </div>
                      <p className="text-2xl font-bold">{stats?.disputePipeline.round2 ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Round 2</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-muted/50 border border-border/50">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-orange-500/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-orange-500">R3</span>
                      </div>
                      <p className="text-2xl font-bold">{stats?.disputePipeline.round3 ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Round 3</p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-muted/50 border border-border/50">
                      <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-yellow-500/10 flex items-center justify-center">
                        <Clock className="w-4 h-4 text-yellow-500" />
                      </div>
                      <p className="text-2xl font-bold">{stats?.disputePipeline.awaiting ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Awaiting</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Success by Bureau */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
          >
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-serif flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-secondary" />
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
                    {(['transunion', 'experian', 'equifax'] as const).map((bureau) => {
                      const data = stats?.successByBureau?.[bureau];
                      const rate = data?.rate ?? 0;
                      const color = bureau === 'transunion' ? 'blue' : bureau === 'experian' ? 'purple' : 'red';
                      return (
                        <div key={bureau} className="text-center p-4 rounded-xl bg-muted/50 border border-border/50">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{bureau}</p>
                          <div className="relative w-16 h-16 mx-auto mb-2">
                            <svg className="w-full h-full transform -rotate-90">
                              <circle
                                cx="32"
                                cy="32"
                                r="28"
                                stroke="currentColor"
                                strokeWidth="6"
                                fill="none"
                                className="text-muted/30"
                              />
                              <circle
                                cx="32"
                                cy="32"
                                r="28"
                                stroke="currentColor"
                                strokeWidth="6"
                                fill="none"
                                strokeDasharray={`${rate * 1.76} 176`}
                                className={`text-${color}-500`}
                                style={{ stroke: `var(--${color}-500, ${color === 'blue' ? '#3b82f6' : color === 'purple' ? '#a855f7' : '#ef4444'})` }}
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
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Today's Work / Needs Attention */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className={`bg-card/80 backdrop-blur-sm border-border/50 ${totalAttention > 0 ? 'border-l-4 border-l-orange-500' : ''}`}>
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
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-500/50" />
                    <p className="text-sm">All caught up! No items need attention.</p>
                  </div>
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
          </motion.div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-serif flex items-center gap-2">
                  <Zap className="w-5 h-5 text-secondary" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                    <Link href="/admin/clients">
                      <Users className="w-5 h-5" />
                      <span className="text-xs">Clients</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                    <Link href="/admin/disputes">
                      <Scale className="w-5 h-5" />
                      <span className="text-xs">Disputes</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                    <Link href="/admin/results">
                      <Trophy className="w-5 h-5" />
                      <span className="text-xs">Results</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                    <Link href="/admin/disputes/wizard">
                      <Zap className="w-5 h-5" />
                      <span className="text-xs">New Dispute</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                    <Link href="/admin/dispute-templates">
                      <FileText className="w-5 h-5" />
                      <span className="text-xs">Templates</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                    <Link href="/admin/tasks">
                      <ListTodo className="w-5 h-5" />
                      <span className="text-xs">Tasks</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right Column - CRM Widgets */}
        <div className="space-y-6">
          {/* Calendar Widget */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <CalendarWidget />
          </motion.div>

          {/* Score Trend Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <ScoreTrendChart />
          </motion.div>

          {/* Onboarding Progress */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <OnboardingProgress />
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
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
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No recent activity</p>
                    <p className="text-xs mt-1">Upload a credit report to get started</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {stats.recentActivity.map((item, _index) => (
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
          </motion.div>
        </div>
      </div>

      {/* Bottom Row - Goals, Team & Automation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
        >
          <GoalTracker />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <TeamActivity />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
        >
          <AutomationStatus />
        </motion.div>
      </div>

      {/* Secondary Stats - New Leads */}
      {(stats?.newLeads ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Link href="/admin/leads">
            <Card className="bg-gradient-to-r from-secondary/5 to-transparent border-secondary/20 hover:border-secondary/40 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary/10">
                    <TrendingUp className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">New Leads Waiting</p>
                    <p className="text-xs text-muted-foreground">Convert leads into clients</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-secondary">{stats?.newLeads ?? 0}</span>
                  <ArrowRight className="w-5 h-5 text-secondary" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </motion.div>
      )}
    </div>
  );
}

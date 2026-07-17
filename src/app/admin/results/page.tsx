'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Trophy,
  TrendingUp,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Sparkles,
  Target,
  Award,
  PartyPopper,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { useAdminRole } from '@/contexts/AdminContext';
import { toast } from 'sonner';
import { formatCurrency, formatItemType } from '@/lib/format';

interface WinRecord {
  id: string;
  client_id: string;
  client_name: string;
  creditor_name: string;
  item_type: string;
  bureau: string;
  amount: number | null;
  deleted_at: string;
  dispute_id: string | null;
  dispute_round: number | null;
}

interface ResultsStats {
  total_deletions: number;
  deletions_this_month: number;
  deletions_this_week: number;
  total_amount_removed: number;
  average_score_increase: number;
  success_rate: number;
  by_bureau: {
    transunion: number;
    experian: number;
    equifax: number;
  };
  by_item_type: Record<string, number>;
  recent_wins: WinRecord[];
  top_performers: Array<{
    client_id: string;
    client_name: string;
    deletions_count: number;
    score_increase: number;
  }>;
}

export default function ResultsPage() {
  const searchParams = useSearchParams();
  const { userId } = useAdminRole();
  const preferencesKey = userId ? `admin-results-default-range:${userId}` : 'admin-results-default-range';
  const [stats, setStats] = React.useState<ResultsStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState<'week' | 'month' | 'all'>(() => {
    const fromUrl = searchParams.get('range');
    if (fromUrl === 'week' || fromUrl === 'month' || fromUrl === 'all') return fromUrl;
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(preferencesKey);
      if (saved === 'week' || saved === 'month' || saved === 'all') {
        return saved;
      }
    }
    return 'month';
  });

  const fetchResults = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/results?range=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  React.useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Disputes"
        title="Results & Wins"
        description="Celebrate client successes and track deletion metrics."
        actions={
          <>
            <div className="flex overflow-hidden rounded-lg border border-border">
              {(['week', 'month', 'all'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-sm transition-colors duration-[160ms] ease-[var(--ease-out)] ${
                    timeRange === range
                      ? 'bg-secondary text-secondary-foreground'
                      : 'bg-card hover:bg-muted'
                  }`}
                >
                  {range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'All Time'}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.localStorage.setItem(preferencesKey, timeRange);
                  toast.success('Current range saved as your default.');
                }
              }}
            >
              Save as Default
            </Button>
            <Button variant="outline" onClick={fetchResults} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
      ) : !stats ? (
        <Card className="bg-card border border-border">
          <CardContent>
            <EmptyState
              icon={Trophy}
              title="No results data available yet."
              description='Log dispute responses as "Deleted" to track wins here.'
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Hero Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
                <p className="text-5xl font-bold text-success">{stats.total_deletions}</p>
                <p className="text-sm text-muted-foreground mt-1">Items Deleted</p>
                {stats.deletions_this_month > 0 && (
                  <p className="text-xs text-success mt-2">
                    +{stats.deletions_this_month} this month
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-secondary/20">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary/20 flex items-center justify-center">
                  <TrendingUp className="w-8 h-8 text-secondary" />
                </div>
                <p className="text-5xl font-bold text-secondary">
                  +{stats.average_score_increase || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Avg Score Increase</p>
                <p className="text-xs text-muted-foreground mt-2">points per client</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning/20 flex items-center justify-center">
                  <Target className="w-8 h-8 text-warning" />
                </div>
                <p className="text-5xl font-bold text-warning">{stats.success_rate}%</p>
                <p className="text-sm text-muted-foreground mt-1">Success Rate</p>
                <p className="text-xs text-muted-foreground mt-2">deletion rate</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Amount Removed Banner */}
          {stats.total_amount_removed > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Card className="bg-gradient-to-r from-secondary/10 via-destructive/10 to-secondary/10 border-secondary/20">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <PartyPopper className="w-10 h-10 text-secondary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Debt Removed from Reports</p>
                      <p className="font-mono text-3xl font-semibold tabular-nums text-secondary">
                        {formatCurrency(stats.total_amount_removed)}
                      </p>
                    </div>
                  </div>
                  <Sparkles className="w-8 h-8 text-secondary/50" />
                </CardContent>
              </Card>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Wins */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="lg:col-span-2"
            >
              <Card className="bg-card border border-border h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Award className="h-4 w-4 text-warning" />
                    Recent Wins
                  </CardTitle>
                  <CardDescription>Latest successful deletions</CardDescription>
                </CardHeader>
                <CardContent>
                  {stats.recent_wins.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Trophy className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p>No wins recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {stats.recent_wins.map((win, index) => (
                        <motion.div
                          key={win.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.1 * index }}
                          className="flex items-center justify-between p-3 rounded-lg bg-success/5 border border-success/20"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                              <CheckCircle2 className="w-5 h-5 text-success" />
                            </div>
                            <div>
                              <p className="font-medium">{win.creditor_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatItemType(win.item_type)} • {win.bureau.toUpperCase()}
                                {win.amount && ` • ${formatCurrency(win.amount)}`}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <Link
                              href={`/admin/clients/${win.client_id}`}
                              className="text-sm font-medium text-secondary hover:underline"
                            >
                              {win.client_name}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {formatTimeAgo(win.deleted_at)}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Stats Sidebar */}
            <div className="space-y-6">
              {/* By Bureau */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <Card className="bg-card border border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Deletions by Bureau</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { bureau: 'TransUnion', count: stats.by_bureau.transunion },
                      { bureau: 'Experian', count: stats.by_bureau.experian },
                      { bureau: 'Equifax', count: stats.by_bureau.equifax },
                    ].map(({ bureau, count }) => (
                      <div key={bureau} className="flex items-center justify-between">
                        <span className="text-sm">{bureau}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-up"
                              style={{
                                width: `${stats.total_deletions ? (count / stats.total_deletions) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium w-8 text-right tabular-nums">{count}</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Top Performers */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <Card className="bg-card border border-border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-warning" />
                      Top Performers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.top_performers.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No data yet
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {stats.top_performers.slice(0, 5).map((performer, index) => (
                          <Link
                            key={performer.client_id}
                            href={`/admin/clients/${performer.client_id}`}
                            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                index === 0 ? 'bg-warning/20 text-warning' :
                                index === 1 ? 'bg-muted/20 text-muted-foreground' :
                                index === 2 ? 'bg-warning/20 text-warning' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {index + 1}
                              </span>
                              <span className="text-sm font-medium">{performer.client_name}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-success">
                                {performer.deletions_count} wins
                              </p>
                              {performer.score_increase > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  +{performer.score_increase} pts
                                </p>
                              )}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* By Item Type */}
              {Object.keys(stats.by_item_type).length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 }}
                >
                  <Card className="bg-card border border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">By Item Type</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {Object.entries(stats.by_item_type)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([type, count]) => (
                          <div key={type} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{formatItemType(type)}</span>
                            <span className="font-medium">{count}</span>
                          </div>
                        ))}
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

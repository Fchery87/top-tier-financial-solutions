'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
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
  const [stats, setStats] = React.useState<ResultsStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [timeRange, setTimeRange] = React.useState<'week' | 'month' | 'all'>('month');

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

  const formatCurrency = (cents: number | null) => {
    if (!cents) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(cents / 100);
  };

  const formatItemType = (type: string) => {
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-serif font-bold text-foreground flex items-center gap-3"
          >
            <Trophy className="w-8 h-8 text-yellow-500" />
            Results & Wins
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground mt-1"
          >
            Celebrate client successes and track deletion metrics
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-2"
        >
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(['week', 'month', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  timeRange === range
                    ? 'bg-secondary text-primary'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                {range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'All Time'}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={fetchResults} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </motion.div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
      ) : !stats ? (
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="py-20 text-center">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">No results data available yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Log dispute responses as “Deleted” to track wins here.
            </p>
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
            <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-5xl font-bold text-green-500">{stats.total_deletions}</p>
                <p className="text-sm text-muted-foreground mt-1">Items Deleted</p>
                {stats.deletions_this_month > 0 && (
                  <p className="text-xs text-green-500 mt-2">
                    +{stats.deletions_this_month} this month
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <TrendingUp className="w-8 h-8 text-blue-500" />
                </div>
                <p className="text-5xl font-bold text-blue-500">
                  +{stats.average_score_increase || 0}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Avg Score Increase</p>
                <p className="text-xs text-muted-foreground mt-2">points per client</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border-yellow-500/20">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Target className="w-8 h-8 text-yellow-500" />
                </div>
                <p className="text-5xl font-bold text-yellow-500">{stats.success_rate}%</p>
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
              <Card className="bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-purple-500/10 border-purple-500/20">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <PartyPopper className="w-10 h-10 text-purple-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Total Debt Removed from Reports</p>
                      <p className="text-3xl font-bold text-purple-500">
                        {formatCurrency(stats.total_amount_removed)}
                      </p>
                    </div>
                  </div>
                  <Sparkles className="w-8 h-8 text-purple-500/50" />
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
              <Card className="bg-card/80 backdrop-blur-sm border-border/50 h-full">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-500" />
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
                          className="flex items-center justify-between p-3 rounded-lg bg-green-500/5 border border-green-500/20"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                              <CheckCircle2 className="w-5 h-5 text-green-500" />
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
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Deletions by Bureau</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { bureau: 'TransUnion', count: stats.by_bureau.transunion, color: 'blue' },
                      { bureau: 'Experian', count: stats.by_bureau.experian, color: 'purple' },
                      { bureau: 'Equifax', count: stats.by_bureau.equifax, color: 'red' },
                    ].map(({ bureau, count, color }) => (
                      <div key={bureau} className="flex items-center justify-between">
                        <span className="text-sm">{bureau}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-${color}-500 rounded-full`}
                              style={{
                                width: `${stats.total_deletions ? (count / stats.total_deletions) * 100 : 0}%`,
                                backgroundColor: color === 'blue' ? '#3b82f6' : color === 'purple' ? '#a855f7' : '#ef4444',
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium w-8 text-right">{count}</span>
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
                <Card className="bg-card/80 backdrop-blur-sm border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-yellow-500" />
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
                                index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                                index === 1 ? 'bg-gray-400/20 text-gray-400' :
                                index === 2 ? 'bg-orange-500/20 text-orange-500' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {index + 1}
                              </span>
                              <span className="text-sm font-medium">{performer.client_name}</span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-500">
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
                  <Card className="bg-card/80 backdrop-blur-sm border-border/50">
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

'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Trophy,
  ArrowRight,
  GitCompare,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface CreditReport {
  id: string;
  file_name: string;
  bureau: string | null;
  uploaded_at: string;
  report_date: string | null;
  parse_status: string;
}

interface ScoreHistory {
  id: string;
  score_transunion: number | null;
  score_experian: number | null;
  score_equifax: number | null;
  average_score: number | null;
  recorded_at: string;
}

interface Dispute {
  id: string;
  bureau: string;
  status: string;
  outcome: string | null;
  creditor_name?: string | null;
  dispute_reason: string;
}

interface ComparisonResult {
  items_removed: Array<{
    id: string;
    creditor_name: string;
    item_type: string;
    amount: number | null;
    bureau: string | null;
    risk_severity: string;
  }>;
  items_removed_count: number;
  items_added: Array<{
    creditor_name: string;
    item_type: string;
  }>;
  items_added_count: number;
  score_changes: {
    by_bureau: Array<{
      bureau: string;
      older_score: number | null;
      newer_score: number | null;
      change: number;
    }>;
    average_change: number | null;
    total_improvement: number;
  } | null;
  older_total_negative_items: number;
  newer_total_negative_items: number;
  summary: {
    is_improvement: boolean;
    net_items_removed: number;
    has_wins: boolean;
  };
}

interface ProgressTabProps {
  clientId: string;
  creditReports: CreditReport[];
  scoreHistory: ScoreHistory[];
  disputes: Dispute[];
}

export function ProgressTab({ clientId, creditReports, scoreHistory, disputes }: ProgressTabProps) {
  const [comparison, setComparison] = React.useState<ComparisonResult | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [selectedReports, setSelectedReports] = React.useState<{ older: string; newer: string } | null>(null);

  const fetchComparison = React.useCallback(async (report1?: string, report2?: string) => {
    if (creditReports.length < 2) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (report1) params.append('report1', report1);
      if (report2) params.append('report2', report2);

      const response = await fetch(`/api/admin/clients/${clientId}/compare-reports?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setComparison(data.comparison);
        setSelectedReports({
          older: data.older_report.id,
          newer: data.newer_report.id,
        });
      }
    } catch (error) {
      console.error('Error fetching comparison:', error);
    } finally {
      setLoading(false);
    }
  }, [clientId, creditReports.length]);

  React.useEffect(() => {
    if (creditReports.length >= 2) {
      fetchComparison();
    }
  }, [fetchComparison, creditReports.length]);

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

  // Calculate wins from disputes
  const wins = disputes.filter(d => d.outcome === 'deleted');
  const totalWins = wins.length;

  // Score progress
  const firstScore = scoreHistory.length > 0 ? scoreHistory[scoreHistory.length - 1] : null;
  const latestScore = scoreHistory.length > 0 ? scoreHistory[0] : null;
  const scoreChange = firstScore && latestScore 
    ? (latestScore.average_score || 0) - (firstScore.average_score || 0)
    : 0;

  return (
    <div className="space-y-6">
      {/* Progress Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
      >
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
          <CardContent className="p-4 text-center">
            <Trophy className="w-6 h-6 mx-auto mb-2 text-green-500" />
            <p className="text-3xl font-bold text-green-500">{totalWins}</p>
            <p className="text-xs text-muted-foreground">Items Deleted</p>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${scoreChange >= 0 ? 'from-blue-500/10 to-cyan-500/5 border-blue-500/20' : 'from-red-500/10 to-orange-500/5 border-red-500/20'}`}>
          <CardContent className="p-4 text-center">
            {scoreChange >= 0 ? (
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-blue-500" />
            ) : (
              <TrendingDown className="w-6 h-6 mx-auto mb-2 text-red-500" />
            )}
            <p className={`text-3xl font-bold ${scoreChange >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
              {scoreChange >= 0 ? '+' : ''}{scoreChange}
            </p>
            <p className="text-xs text-muted-foreground">Score Change</p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-purple-500" />
            <p className="text-3xl font-bold">{disputes.filter(d => d.status === 'sent').length}</p>
            <p className="text-xs text-muted-foreground">Active Disputes</p>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="p-4 text-center">
            <GitCompare className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
            <p className="text-3xl font-bold">{creditReports.length}</p>
            <p className="text-xs text-muted-foreground">Reports Analyzed</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Wins Celebration */}
      {wins.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-green-500/5 border-green-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Trophy className="w-5 h-5 text-yellow-500" />
                Wins & Deletions
              </CardTitle>
              <CardDescription>Items successfully removed from credit reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {wins.map((win, index) => (
                  <motion.div
                    key={win.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 * index }}
                    className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="font-medium">{win.creditor_name || win.dispute_reason}</p>
                        <p className="text-xs text-muted-foreground">
                          {win.bureau.toUpperCase()} • Deleted
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Report Comparison */}
      {creditReports.length >= 2 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GitCompare className="w-5 h-5 text-secondary" />
                  Report Comparison
                </CardTitle>
                <CardDescription>Compare changes between credit reports</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchComparison()}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-secondary" />
                </div>
              ) : comparison ? (
                <div className="space-y-6">
                  {/* Report Selection */}
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">Older Report</label>
                      <select
                        value={selectedReports?.older || ''}
                        onChange={(e) => {
                          if (selectedReports?.newer) {
                            fetchComparison(e.target.value, selectedReports.newer);
                          }
                        }}
                        className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                      >
                        {creditReports.map((report) => (
                          <option key={report.id} value={report.id}>
                            {new Date(report.uploaded_at).toLocaleDateString()} - {report.bureau || 'Combined'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">Newer Report</label>
                      <select
                        value={selectedReports?.newer || ''}
                        onChange={(e) => {
                          if (selectedReports?.older) {
                            fetchComparison(selectedReports.older, e.target.value);
                          }
                        }}
                        className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                      >
                        {creditReports.map((report) => (
                          <option key={report.id} value={report.id}>
                            {new Date(report.uploaded_at).toLocaleDateString()} - {report.bureau || 'Combined'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Score Changes */}
                  {comparison.score_changes && (
                    <div>
                      <h4 className="text-sm font-medium mb-3">Score Changes</h4>
                      <div className="grid grid-cols-3 gap-4">
                        {comparison.score_changes.by_bureau.map((change) => (
                          <div
                            key={change.bureau}
                            className={`p-3 rounded-lg text-center ${
                              change.change > 0
                                ? 'bg-green-500/10 border border-green-500/20'
                                : change.change < 0
                                ? 'bg-red-500/10 border border-red-500/20'
                                : 'bg-muted/50'
                            }`}
                          >
                            <p className="text-xs text-muted-foreground capitalize mb-1">{change.bureau}</p>
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-sm text-muted-foreground">{change.older_score || '—'}</span>
                              <ArrowRight className="w-3 h-3" />
                              <span className="text-sm font-medium">{change.newer_score || '—'}</span>
                            </div>
                            <p className={`text-lg font-bold ${
                              change.change > 0 ? 'text-green-500' : change.change < 0 ? 'text-red-500' : ''
                            }`}>
                              {change.change > 0 ? '+' : ''}{change.change}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Items Removed (WINS!) */}
                  {comparison.items_removed_count > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        Items Removed ({comparison.items_removed_count})
                      </h4>
                      <div className="space-y-2">
                        {comparison.items_removed.map((item, index) => (
                          <div
                            key={item.id || index}
                            className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20"
                          >
                            <div>
                              <p className="font-medium text-green-700 dark:text-green-400">{item.creditor_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatItemType(item.item_type)} • {item.bureau?.toUpperCase() || 'Unknown'}
                                {item.amount && ` • ${formatCurrency(item.amount)}`}
                              </p>
                            </div>
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Items Added (New problems) */}
                  {comparison.items_added_count > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-500" />
                        New Items ({comparison.items_added_count})
                      </h4>
                      <div className="space-y-2">
                        {comparison.items_added.map((item, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10 border border-orange-500/20"
                          >
                            <div>
                              <p className="font-medium">{item.creditor_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatItemType(item.item_type)}
                              </p>
                            </div>
                            <AlertTriangle className="w-5 h-5 text-orange-500" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className={`p-4 rounded-lg ${
                    comparison.summary.is_improvement
                      ? 'bg-green-500/10 border border-green-500/20'
                      : 'bg-muted/50'
                  }`}>
                    <p className="text-sm">
                      {comparison.summary.is_improvement ? (
                        <>
                          <span className="font-medium text-green-600 dark:text-green-400">Progress Made!</span>
                          {' '}{comparison.summary.net_items_removed} net items removed.
                          {' '}Negative items: {comparison.older_total_negative_items} → {comparison.newer_total_negative_items}
                        </>
                      ) : comparison.items_removed_count === 0 && comparison.items_added_count === 0 ? (
                        <span className="text-muted-foreground">No changes detected between reports.</span>
                      ) : (
                        <>
                          {comparison.items_added_count} new items appeared.
                          {' '}Negative items: {comparison.older_total_negative_items} → {comparison.newer_total_negative_items}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <GitCompare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Unable to compare reports</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="py-12 text-center">
            <GitCompare className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground">Upload at least 2 credit reports to compare progress.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Currently have {creditReports.length} report(s).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Score Timeline */}
      {scoreHistory.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-secondary" />
                Score History
              </CardTitle>
              <CardDescription>Credit score progression over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Timeline */}
                <div className="relative">
                  {scoreHistory.slice(0, 10).reverse().map((entry, index, arr) => {
                    const prevEntry = index > 0 ? arr[index - 1] : null;
                    const change = prevEntry
                      ? (entry.average_score || 0) - (prevEntry.average_score || 0)
                      : 0;

                    return (
                      <div key={entry.id} className="flex items-center gap-4 py-3 border-b border-border/50 last:border-0">
                        <div className="w-24 text-xs text-muted-foreground">
                          {new Date(entry.recorded_at).toLocaleDateString()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-blue-500">TU</span>
                              <span className="font-medium">{entry.score_transunion || '—'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-purple-500">EX</span>
                              <span className="font-medium">{entry.score_experian || '—'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-500">EQ</span>
                              <span className="font-medium">{entry.score_equifax || '—'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="w-20 text-right">
                          {index > 0 && change !== 0 && (
                            <span className={`text-sm font-medium ${
                              change > 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                              {change > 0 ? '+' : ''}{change}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}

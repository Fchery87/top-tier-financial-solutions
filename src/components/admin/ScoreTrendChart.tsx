'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Loader2, Trophy, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import Link from 'next/link';

interface TrendPoint {
  date: string;
  avgScore: number;
  clientCount: number;
}

interface TopImprover {
  clientId: string;
  clientName: string;
  startScore: number;
  currentScore: number;
  improvement: number;
}

interface TrendData {
  trends: TrendPoint[];
  topImprovers: TopImprover[];
  stats: {
    averageScore: number;
    totalImprovement: number;
    clientsTracked: number;
  };
}

function MiniLineChart({ data, width = 300, height = 100 }: { data: TrendPoint[]; width?: number; height?: number }) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[100px] text-muted-foreground">
        <span className="text-sm">No data available</span>
      </div>
    );
  }

  const padding = { top: 10, right: 10, bottom: 20, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const scores = data.map(d => d.avgScore);
  const minScore = Math.min(...scores) - 20;
  const maxScore = Math.max(...scores) + 20;
  const scoreRange = maxScore - minScore;

  const xScale = (index: number) => padding.left + (index / (data.length - 1 || 1)) * chartWidth;
  const yScale = (score: number) => padding.top + chartHeight - ((score - minScore) / scoreRange) * chartHeight;

  // Create path
  const pathData = data.map((point, i) => {
    const x = xScale(i);
    const y = yScale(point.avgScore);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Create area path
  const areaPath = `${pathData} L ${xScale(data.length - 1)} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

  // Format month label
  const formatMonth = (dateStr: string) => {
    const [_year, month] = dateStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[parseInt(month) - 1];
  };

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Grid lines */}
      {[0, 1, 2].map((i) => {
        const y = padding.top + (i / 2) * chartHeight;
        const score = Math.round(maxScore - (i / 2) * scoreRange);
        return (
          <g key={i}>
            <line
              x1={padding.left}
              y1={y}
              x2={width - padding.right}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeDasharray="4 4"
            />
            <text
              x={padding.left - 5}
              y={y + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {score}
            </text>
          </g>
        );
      })}

      {/* Area fill */}
      <motion.path
        d={areaPath}
        fill="url(#gradient)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.2 }}
        transition={{ duration: 0.5 }}
      />

      {/* Line */}
      <motion.path
        d={pathData}
        fill="none"
        stroke="hsl(var(--secondary))"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />

      {/* Points */}
      {data.map((point, i) => (
        <motion.circle
          key={i}
          cx={xScale(i)}
          cy={yScale(point.avgScore)}
          r={4}
          fill="hsl(var(--background))"
          stroke="hsl(var(--secondary))"
          strokeWidth={2}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.5 + i * 0.1 }}
        />
      ))}

      {/* X-axis labels */}
      {data.map((point, i) => (
        <text
          key={i}
          x={xScale(i)}
          y={height - 5}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          {formatMonth(point.date)}
        </text>
      ))}

      {/* Gradient definition */}
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="hsl(var(--secondary))" stopOpacity={0.3} />
          <stop offset="100%" stopColor="hsl(var(--secondary))" stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ScoreTrendChart() {
  const [data, setData] = React.useState<TrendData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchTrends() {
      try {
        const response = await fetch('/api/admin/dashboard/trends');
        if (response.ok) {
          const trendData = await response.json();
          setData(trendData);
        }
      } catch (error) {
        console.error('Error fetching trends:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchTrends();
  }, []);

  if (loading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-secondary" />
            Credit Score Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-serif flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-secondary" />
              Credit Score Trends
            </CardTitle>
            <CardDescription>
              Average scores across {data?.stats.clientsTracked || 0} tracked clients
            </CardDescription>
          </div>
          {data?.stats.averageScore && (
            <div className="text-right">
              <p className="text-2xl font-bold text-foreground">{data.stats.averageScore}</p>
              <p className="text-xs text-muted-foreground">Current Avg</p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Chart */}
          <div className="flex justify-center">
            <MiniLineChart data={data?.trends || []} width={350} height={120} />
          </div>

          {/* Top Improvers */}
          {data?.topImprovers && data.topImprovers.length > 0 && (
            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium">Top Improvers</span>
              </div>
              <div className="space-y-2">
                {data.topImprovers.slice(0, 3).map((improver, index) => (
                  <Link
                    key={improver.clientId}
                    href={`/admin/clients/${improver.clientId}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                        index === 1 ? 'bg-slate-400/20 text-slate-400' :
                        'bg-orange-500/20 text-orange-500'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="text-sm truncate max-w-[120px]">{improver.clientName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {improver.startScore} → {improver.currentScore}
                      </span>
                      <span className="text-xs font-semibold text-green-500 flex items-center">
                        +{improver.improvement}
                        <ArrowUpRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* No data state */}
          {(!data?.trends || data.trends.length === 0) && (
            <div className="text-center py-6 text-muted-foreground">
              <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No score history yet</p>
              <p className="text-xs mt-1">Upload credit reports to track progress</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import type { ScoreHistoryEntry, ScoreSummary } from '@/components/portal/types';

interface PortalScoreHistoryProps {
  scoreHistory: ScoreHistoryEntry[];
  scoreSummary: ScoreSummary | null;
}

export default function PortalScoreHistory({ scoreHistory, scoreSummary }: PortalScoreHistoryProps) {
  if (scoreHistory.length <= 1) return null;

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="font-display text-xl flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-secondary" />
          Score Progress
        </CardTitle>
        <CardDescription>
          Your credit score journey over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        {scoreSummary && (
          <div className="mb-6 p-4 rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Change</p>
                <div className="flex items-center gap-2">
                  {scoreSummary.total_change >= 0 ? (
                    <TrendingUp className="w-5 h-5 text-success" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-destructive" />
                  )}
                  <p className={`font-display text-3xl font-light tabular-nums ${
                    scoreSummary.total_change >= 0 ? 'text-success' : 'text-destructive'
                  }`}>
                    {scoreSummary.total_change >= 0 ? '+' : ''}{scoreSummary.total_change} pts
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Current Average</p>
                <p className="font-display text-3xl font-light tabular-nums text-foreground">
                  {scoreSummary.current_average || '---'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="h-32 flex items-end gap-1">
          {scoreHistory.slice(0, 12).reverse().map((entry, index) => {
            const score = entry.average_score || 0;
            const maxScore = 850;
            const heightPercent = (score / maxScore) * 100;

            return (
              <div key={entry.id} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-secondary rounded-t transition-all hover:bg-secondary/80"
                  style={{ height: `${Math.max(heightPercent, 5)}%`, minHeight: '4px' }}
                  title={`${score} - ${new Date(entry.recorded_at).toLocaleDateString()}`}
                />
                {index % 3 === 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(entry.recorded_at).toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Target, TrendingUp, Zap, Calendar, Clock, AlertCircle,
  CheckCircle,
} from 'lucide-react';
import type { ClientCase } from '@/components/portal/types';
import { phaseLabels, statusColors } from '@/components/portal/types';

interface PortalCaseStatusProps {
  activeCase: ClientCase | undefined;
}

export default function PortalCaseStatus({ activeCase }: PortalCaseStatusProps) {
  if (!activeCase) return null;

  const scoreImprovement = activeCase.credit_score_current && activeCase.credit_score_start
    ? activeCase.credit_score_current - activeCase.credit_score_start
    : 0;

  const statCards = [
    { label: 'Current Score', value: activeCase.credit_score_current ?? '---', icon: Target, tone: 'text-secondary' },
    { label: 'Score Improvement', value: `+${scoreImprovement} pts`, icon: TrendingUp, tone: 'text-success' },
    { label: 'Items Removed', value: activeCase.negative_items_removed || 0, icon: Zap, tone: 'text-secondary' },
    { label: 'Case Status', value: activeCase.status || 'N/A', icon: Calendar, tone: 'text-foreground capitalize' },
  ];

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className={`mt-2 font-display text-3xl font-light tracking-tight tabular-nums ${stat.tone}`}>
                      {stat.value}
                    </p>
                  </div>
                  <Icon className={`h-5 w-5 ${stat.tone}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl flex items-center gap-2">
              <Clock className="w-5 h-5 text-secondary" />
              Current Phase and Readiness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <span className={`px-3 py-2 rounded-md text-sm font-medium border ${statusColors[activeCase.status || 'pending']}`}>
                {activeCase.status?.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-foreground font-medium">
                {phaseLabels[activeCase.current_phase || 'initial_review']}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(phaseLabels).map(([key, label], idx) => {
                const phases = Object.keys(phaseLabels);
                const currentIdx = phases.indexOf(activeCase.current_phase || 'initial_review');
                const isComplete = idx < currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                  <div key={key} className={`flex items-center gap-2 rounded-md border px-3 py-2 ${
                      isComplete ? 'bg-success/10 text-success border-success/25' :
                      isCurrent ? 'bg-secondary/10 text-secondary border-secondary/25' :
                      'bg-muted/30 text-muted-foreground'
                    }`}>
                      {isComplete ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : isCurrent ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-current" />
                      )}
                      <span className="text-xs font-medium">{label}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-secondary" />
              Recent Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeCase.updates && activeCase.updates.length > 0 ? (
              <div className="space-y-4">
                {activeCase.updates.map((update) => (
                  <div key={update.id} className="flex gap-4 rounded-md border border-border/70 bg-muted/25 p-4">
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-secondary" />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{update.title}</p>
                      {update.description && (
                        <p className="text-sm text-muted-foreground mt-1">{update.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(update.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No updates yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

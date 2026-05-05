'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Target, TrendingUp, Zap, Calendar, Clock, AlertCircle,
  CheckCircle, ChevronRight,
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
    { label: 'Current Score', value: activeCase.credit_score_current ?? '---', icon: Target, color: 'bg-secondary/20', textColor: '', delay: 0.1 },
    { label: 'Score Improvement', value: `+${scoreImprovement} pts`, icon: TrendingUp, color: 'bg-green-500/20', textColor: 'text-green-500', delay: 0.2 },
    { label: 'Items Removed', value: activeCase.negative_items_removed || 0, icon: Zap, color: 'bg-blue-500/20', textColor: '', delay: 0.3 },
    { label: 'Case Status', value: activeCase.status || 'N/A', icon: Calendar, color: 'bg-purple-500/20', textColor: 'capitalize', delay: 0.4 },
  ];

  return (
    <>
      <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: stat.delay }}
            >
              <Card className="bg-card/80 backdrop-blur-sm border-border/50 hover:border-secondary/50 transition-all">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-xl ${stat.color}`}>
                      <Icon className={`w-6 h-6 ${stat.textColor || 'text-secondary'}`} />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className={`text-2xl font-bold text-foreground ${stat.label === 'Case Status' ? stat.textColor : ''}`}>
                        {stat.value}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="font-serif text-xl flex items-center gap-2">
              <Clock className="w-5 h-5 text-secondary" />
              Current Phase
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <span className={`px-4 py-2 rounded-full text-sm font-medium border ${statusColors[activeCase.status || 'pending']}`}>
                {activeCase.status?.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-foreground font-medium">
                {phaseLabels[activeCase.current_phase || 'initial_review']}
              </span>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-4">
              {Object.entries(phaseLabels).map(([key, label], idx) => {
                const phases = Object.keys(phaseLabels);
                const currentIdx = phases.indexOf(activeCase.current_phase || 'initial_review');
                const isComplete = idx < currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                  <div key={key} className="flex items-center">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap ${
                      isComplete ? 'bg-green-500/20 text-green-400' :
                      isCurrent ? 'bg-secondary/20 text-secondary' :
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
                    {idx < Object.keys(phaseLabels).length - 1 && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="font-serif text-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-secondary" />
              Recent Updates
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeCase.updates && activeCase.updates.length > 0 ? (
              <div className="space-y-4">
                {activeCase.updates.map((update) => (
                  <div key={update.id} className="flex gap-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-secondary mt-2" />
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

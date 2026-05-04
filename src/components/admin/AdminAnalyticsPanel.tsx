'use client';

import * as React from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';

interface OperatorAnalytics {
  import_success: { pending_or_failed_reports: number };
  response_aging: { due_soon: number; overdue: number };
  cycle_throughput: { active_cycles: number };
  billing_readiness: { services_rendered_events: number };
  workload: { open_tasks: number };
}

interface ClientOutcomeAnalytics {
  outcomes: { deleted: number; updated: number; verified: number };
  score_movement: { total: number };
  new_negatives: { count: number };
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/40 p-3">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function AdminAnalyticsPanel() {
  const [operatorAnalytics, setOperatorAnalytics] = React.useState<OperatorAnalytics | null>(null);
  const [clientOutcomeAnalytics, setClientOutcomeAnalytics] = React.useState<ClientOutcomeAnalytics | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchAnalytics() {
      try {
        const [operatorResponse, clientOutcomeResponse] = await Promise.all([
          fetch('/api/admin/operator-analytics'),
          fetch('/api/admin/client-outcome-analytics'),
        ]);

        if (cancelled) return;

        if (operatorResponse.ok) {
          const data = await operatorResponse.json();
          setOperatorAnalytics(data.operator_analytics ?? null);
        }

        if (clientOutcomeResponse.ok) {
          const data = await clientOutcomeResponse.json();
          setClientOutcomeAnalytics(data.client_outcome_analytics ?? null);
        }
      } catch (error) {
        console.error('Error fetching admin analytics:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAnalytics();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="grid grid-cols-1 xl:grid-cols-2 gap-6" aria-label="Admin analytics">
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-secondary" />
            Operator Analytics
          </CardTitle>
          <CardDescription>Internal workflow health and readiness metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8" aria-label="Loading operator analytics">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Metric label="Pending imports" value={operatorAnalytics?.import_success.pending_or_failed_reports ?? 0} />
              <Metric label="Responses due soon" value={operatorAnalytics?.response_aging.due_soon ?? 0} />
              <Metric label="Overdue responses" value={operatorAnalytics?.response_aging.overdue ?? 0} />
              <Metric label="Active cycles" value={operatorAnalytics?.cycle_throughput.active_cycles ?? 0} />
              <Metric label="Service events" value={operatorAnalytics?.billing_readiness.services_rendered_events ?? 0} />
              <Metric label="Open tasks" value={operatorAnalytics?.workload.open_tasks ?? 0} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-secondary" />
            Client Outcome Analytics
          </CardTitle>
          <CardDescription>Client-visible outcomes tracked separately from operations</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8" aria-label="Loading client outcome analytics">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Metric label="Deleted outcomes" value={clientOutcomeAnalytics?.outcomes.deleted ?? 0} />
              <Metric label="Updated outcomes" value={clientOutcomeAnalytics?.outcomes.updated ?? 0} />
              <Metric label="Verified outcomes" value={clientOutcomeAnalytics?.outcomes.verified ?? 0} />
              <Metric label="Score movement" value={clientOutcomeAnalytics?.score_movement.total ?? 0} />
              <Metric label="New negatives" value={clientOutcomeAnalytics?.new_negatives.count ?? 0} />
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

'use client';

import * as React from 'react';
import {
  Mail,
  Phone,
  Save,
  Loader2,
  CheckCircle2,
  Lightbulb,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Upload,
  Scale,
  CheckSquare,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type {
  ClientDetail,
  CreditAnalysis,
  ClientReadiness,
  ScoreHistory,
  Dispute,
  CreditReport,
  ClientNote,
  Task,
} from './types';
import { statusOptions, getScoreColor } from './types';

interface OverviewTabProps {
  client: ClientDetail;
  clientId: string;
  latestAnalysis: CreditAnalysis | null;
  readiness: ClientReadiness | null;
  scoreHistory: ScoreHistory[];
  negativeItemsCount: number;
  disputes: Dispute[];
  creditReports: CreditReport[];
  clientNotes: ClientNote[];
  clientTasks: Task[];
  onClientUpdated: (updated: ClientDetail) => void;
  onSendNudge: () => void;
  sendingNudge: boolean;
}

type TimelineEvent = {
  id: string;
  type: 'report' | 'dispute' | 'task' | 'note';
  icon: React.ElementType;
  description: string;
  timestamp: string;
  color: string;
};

function buildTimeline(
  reports: CreditReport[],
  disputes: Dispute[],
  tasks: Task[],
  notes: ClientNote[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const r of reports) {
    events.push({
      id: `report-${r.id}`,
      type: 'report',
      icon: FileText,
      description: `Credit report uploaded (${r.bureau || 'combined'})`,
      timestamp: r.uploaded_at,
      color: 'text-muted-foreground',
    });
  }

  for (const d of disputes) {
    events.push({
      id: `dispute-${d.id}`,
      type: 'dispute',
      icon: Scale,
      description: `Dispute created: ${d.dispute_reason?.slice(0, 60)}${d.dispute_reason?.length > 60 ? '...' : ''}`,
      timestamp: d.created_at,
      color: 'text-secondary',
    });
  }

  for (const t of tasks) {
    const verb = t.status === 'done' ? 'completed' : 'created';
    events.push({
      id: `task-${t.id}`,
      type: 'task',
      icon: CheckSquare,
      description: `Task ${verb}: ${t.title}`,
      timestamp: t.created_at,
      color: 'text-muted-foreground',
    });
  }

  for (const n of notes) {
    events.push({
      id: `note-${n.id}`,
      type: 'note',
      icon: MessageSquare,
      description: `Note added by ${n.author_name || 'unknown'}`,
      timestamp: n.created_at,
      color: 'text-muted-foreground',
    });
  }

  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return events;
}

export function OverviewTab({
  client,
  clientId,
  latestAnalysis,
  readiness,
  scoreHistory,
  negativeItemsCount,
  disputes,
  creditReports,
  clientNotes,
  clientTasks,
  onClientUpdated,
  onSendNudge,
  sendingNudge,
}: OverviewTabProps) {
  const [editMode, setEditMode] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editedClient, setEditedClient] = React.useState<Partial<ClientDetail>>(client);

  const timeline = React.useMemo(
    () => buildTimeline(creditReports, disputes, clientTasks, clientNotes),
    [creditReports, disputes, clientTasks, clientNotes],
  );

  const completedTasks = clientTasks.filter((t) => t.status === 'done').length;

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedClient),
      });
      if (response.ok) {
        onClientUpdated({ ...client, ...editedClient } as ClientDetail);
        setEditMode(false);
      }
    } catch (error) {
      console.error('Error saving client:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="space-y-6">
        <Card className="bg-card border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold">Contact Information</CardTitle>
            {!editMode ? (
              <Button variant="ghost" size="sm" onClick={() => setEditMode(true)}>Edit</Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditMode(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {editMode ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">First Name</label>
                    <Input value={editedClient.first_name || ''} onChange={(e) => setEditedClient({ ...editedClient, first_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last Name</label>
                    <Input value={editedClient.last_name || ''} onChange={(e) => setEditedClient({ ...editedClient, last_name: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input value={editedClient.email || ''} onChange={(e) => setEditedClient({ ...editedClient, email: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input value={editedClient.phone || ''} onChange={(e) => setEditedClient({ ...editedClient, phone: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <select value={editedClient.status || ''} onChange={(e) => setEditedClient({ ...editedClient, status: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm">
                    {statusOptions.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <textarea value={editedClient.notes || ''} onChange={(e) => setEditedClient({ ...editedClient, notes: e.target.value })} className="w-full min-h-[80px] px-3 py-2 text-sm rounded-md border border-input bg-background" />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{client.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{client.phone || 'No phone number'}</span>
                </div>
                {client.notes && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-sm text-muted-foreground">{client.notes}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {readiness && (
          <Card className="bg-card border border-border">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4 text-secondary" />
                Onboarding & Readiness
              </CardTitle>
              <CardDescription>
                Snapshot of where this client is in the user-to-client workflow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                  readiness.is_ready_for_round
                    ? 'border-success/30 bg-success/10 text-success'
                    : readiness.blocking_tasks > 0 || readiness.unfinished_client_tasks > 0
                      ? 'border-warning/30 bg-warning/10 text-warning'
                      : 'border-muted bg-muted/30 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  {readiness.is_ready_for_round ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span className="font-medium">
                    {readiness.is_ready_for_round ? 'Ready for next dispute round' : 'Waiting on client'}
                  </span>
                </div>
                {!readiness.is_ready_for_round && (
                  <span className="text-xs">
                    {readiness.blocking_tasks > 0
                      ? `${readiness.blocking_tasks} blocking task${readiness.blocking_tasks > 1 ? 's' : ''}`
                      : readiness.unfinished_client_tasks > 0
                        ? `${readiness.unfinished_client_tasks} open task${readiness.unfinished_client_tasks > 1 ? 's' : ''}`
                        : 'Setup incomplete'}
                  </span>
                )}
              </div>

              {readiness.at_risk && readiness.waiting_on_client_days !== null && (
                <div className="mt-2 flex items-center justify-between rounded-lg border px-3 py-2 text-xs border-destructive/30 bg-destructive/10 text-destructive">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="font-medium">Client at risk</span>
                  </div>
                  <span>Waiting on client for {readiness.waiting_on_client_days} day{readiness.waiting_on_client_days === 1 ? '' : 's'}</span>
                </div>
              )}

              <ul className="space-y-1 text-sm">
                {[
                  { label: 'Portal account linked', value: readiness.has_portal_user },
                  { label: 'Service agreement signed', value: readiness.has_signed_agreement },
                  { label: 'Credit report uploaded', value: readiness.has_credit_report },
                  { label: 'Credit report analyzed', value: readiness.has_analyzed_report },
                  { label: 'Client case created', value: readiness.has_case },
                  { label: 'At least one dispute created', value: readiness.has_disputes },
                ].map((item) => (
                  <li key={item.label} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className={`flex items-center gap-1 text-xs font-medium ${item.value ? 'text-success' : 'text-muted-foreground'}`}>
                      {item.value ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {item.value ? 'Done' : 'Pending'}
                    </span>
                  </li>
                ))}
              </ul>

              {readiness.at_risk && (
                <div className="pt-3 flex justify-end">
                  <Button variant="outline" size="sm" onClick={onSendNudge} disabled={sendingNudge}>
                    {sendingNudge ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Mail className="w-3 h-3 mr-1" />}
                    Send reminder
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="lg:col-span-2 space-y-6">
        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Credit Scores</CardTitle>
            <CardDescription>
              {latestAnalysis ? `Last updated ${new Date(latestAnalysis.created_at).toLocaleDateString()}` : 'No analysis available'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {latestAnalysis ? (
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">TransUnion</p>
                  <p className={`font-display text-4xl font-light tabular-nums ${getScoreColor(latestAnalysis.score_transunion)}`}>
                    {latestAnalysis.score_transunion || '—'}
                  </p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Experian</p>
                  <p className={`font-display text-4xl font-light tabular-nums ${getScoreColor(latestAnalysis.score_experian)}`}>
                    {latestAnalysis.score_experian || '—'}
                  </p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">Equifax</p>
                  <p className={`font-display text-4xl font-light tabular-nums ${getScoreColor(latestAnalysis.score_equifax)}`}>
                    {latestAnalysis.score_equifax || '—'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                Upload a credit report to see scores and analysis.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-card border border-border">
            <CardContent className="p-4 text-center">
              <Upload className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
              <p className="font-display text-3xl font-light tabular-nums">{creditReports.length}</p>
              <p className="text-xs text-muted-foreground">Reports Uploaded</p>
            </CardContent>
          </Card>
          <Card className="bg-card border border-border">
            <CardContent className="p-4 text-center">
              <Scale className="w-5 h-5 mx-auto mb-2 text-secondary" />
              <p className="font-display text-3xl font-light tabular-nums">{disputes.length}</p>
              <p className="text-xs text-muted-foreground">Disputes Sent</p>
            </CardContent>
          </Card>
          <Card className="bg-card border border-border">
            <CardContent className="p-4 text-center">
              <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-destructive" />
              <p className="font-display text-3xl font-light tabular-nums">{negativeItemsCount}</p>
              <p className="text-xs text-muted-foreground">Items Flagged</p>
            </CardContent>
          </Card>
          <Card className="bg-card border border-border">
            <CardContent className="p-4 text-center">
              <CheckSquare className="w-5 h-5 mx-auto mb-2 text-success" />
              <p className="font-display text-3xl font-light tabular-nums">{completedTasks}</p>
              <p className="text-xs text-muted-foreground">Tasks Completed</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Activity Timeline</CardTitle>
            <CardDescription>Recent activity for this client</CardDescription>
          </CardHeader>
          <CardContent>
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No activity yet.</p>
            ) : (
              <div className="relative space-y-0">
                <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
                {timeline.slice(0, 20).map((event) => (
                  <div key={event.id} className="flex items-start gap-4 py-2 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-muted flex-shrink-0 z-10 ${event.color}`}>
                      <event.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{event.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {latestAnalysis?.recommendations && latestAnalysis.recommendations.length > 0 && (
          <Card className="bg-card border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Lightbulb className="h-4 w-4 text-secondary" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {latestAnalysis.recommendations.slice(0, 3).map((rec, index) => (
                  <li key={index} className="flex items-start gap-3 p-2 rounded-lg bg-muted/50">
                    <CheckCircle2 className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {scoreHistory.length > 0 && (
          <Card className="bg-card border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <TrendingUp className="h-4 w-4 text-success" />
                Score Progress
              </CardTitle>
              <CardDescription>Credit score changes over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-48 flex items-end gap-1">
                  {scoreHistory.slice(-12).map((entry, index) => {
                    const maxScore = 850;
                    const score = entry.average_score || 0;
                    const heightPercent = (score / maxScore) * 100;
                    const prevScore = index > 0 ? (scoreHistory.slice(-12)[index - 1]?.average_score || 0) : score;
                    const isImprovement = score > prevScore;

                    return (
                      <div key={entry.id} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className={`w-full rounded-t transition-all ${isImprovement ? 'bg-success' : score < prevScore ? 'bg-destructive' : 'bg-secondary'}`}
                          style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                          title={`${score} - ${new Date(entry.recorded_at).toLocaleDateString()}`}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(entry.recorded_at).toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {scoreHistory.length >= 2 && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">Score Change</p>
                      <p className="text-xs text-muted-foreground">
                        From {scoreHistory[0]?.average_score || '—'} to {scoreHistory[scoreHistory.length - 1]?.average_score || '—'}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 font-display text-2xl font-light tabular-nums ${
                      (scoreHistory[scoreHistory.length - 1]?.average_score || 0) > (scoreHistory[0]?.average_score || 0) ? 'text-success' : 'text-destructive'
                    }`}>
                      {(scoreHistory[scoreHistory.length - 1]?.average_score || 0) > (scoreHistory[0]?.average_score || 0) ? (
                        <TrendingUp className="w-5 h-5" />
                      ) : (
                        <TrendingDown className="w-5 h-5" />
                      )}
                      {Math.abs((scoreHistory[scoreHistory.length - 1]?.average_score || 0) - (scoreHistory[0]?.average_score || 0))} pts
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

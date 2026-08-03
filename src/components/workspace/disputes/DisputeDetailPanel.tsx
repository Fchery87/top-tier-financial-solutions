'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { LetterStudio } from '@/components/workspace/disputes/LetterStudio';

interface Dispute {
  id: string;
  client_id: string;
  client_name: string;
  bureau: string;
  dispute_reason: string;
  status: string;
  round: number;
  letter_content: string | null;
  response_deadline: string | null;
  response_received_at: string | null;
  outcome: string | null;
  response_notes: string | null;
  response_document_url?: string | null;
  response_channel: string | null;
  score_impact: number | null;
  creditor_name: string | null;
}

type RecommendationKind = 'close' | 'refresh_item' | 'no_further_action' | 'create_next_draft';

interface ResponseReviewRecommendation {
  kind: RecommendationKind;
  title: string;
  detail: string;
}

const OUTCOME_OPTIONS = [
  { value: '', label: 'Select outcome' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'verified', label: 'Verified' },
  { value: 'updated', label: 'Updated or modified' },
  { value: 'no_response', label: 'No response after deadline' },
  { value: 'frivolous', label: 'Marked frivolous' },
];

interface DisputeDetailPanelProps {
  open: boolean;
  dispute: Dispute | null;
  onClose: () => void;
  onResponseLogged: () => void;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === 'object'
    && payload !== null
    && 'error' in payload
    && typeof payload.error === 'string'
  ) {
    return payload.error;
  }
  return fallback;
}

function getRecommendation(payload: unknown): ResponseReviewRecommendation | null {
  if (
    typeof payload !== 'object'
    || payload === null
    || !('next_cycle_recommendation' in payload)
  ) {
    return null;
  }

  const recommendation = payload.next_cycle_recommendation;
  if (
    typeof recommendation !== 'object'
    || recommendation === null
    || !('kind' in recommendation)
    || !('title' in recommendation)
    || !('detail' in recommendation)
    || typeof recommendation.kind !== 'string'
    || typeof recommendation.title !== 'string'
    || typeof recommendation.detail !== 'string'
  ) {
    return null;
  }

  const validKinds: ReadonlySet<string> = new Set([
    'close',
    'refresh_item',
    'no_further_action',
    'create_next_draft',
  ]);
  if (!validKinds.has(recommendation.kind)) return null;

  return {
    kind: recommendation.kind as RecommendationKind,
    title: recommendation.title,
    detail: recommendation.detail,
  };
}

export function DisputeDetailPanel({ open, dispute, onClose, onResponseLogged }: DisputeDetailPanelProps) {
  const [responseOutcome, setResponseOutcome] = React.useState('');
  const [responseNotes, setResponseNotes] = React.useState('');
  const [responseDate, setResponseDate] = React.useState('');
  const [responseChannel, setResponseChannel] = React.useState('mail');
  const [responseDocumentUrl, setResponseDocumentUrl] = React.useState('');
  const [scoreImpact, setScoreImpact] = React.useState('');
  const [recommendation, setRecommendation] = React.useState<ResponseReviewRecommendation | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [creatingDraft, setCreatingDraft] = React.useState(false);

  React.useEffect(() => {
    if (dispute) {
      setResponseOutcome('');
      setResponseNotes('');
      setResponseDate(new Date().toISOString().split('T')[0]);
      setResponseChannel(dispute.response_channel || 'mail');
      setResponseDocumentUrl(dispute.response_document_url || '');
      setScoreImpact(dispute.score_impact !== null && dispute.score_impact !== undefined ? String(dispute.score_impact) : '');
      setRecommendation(null);
    }
  }, [dispute]);

  const isNoResponse = responseOutcome === 'no_response';

  const handleSubmitResponse = async () => {
    if (!dispute || !responseOutcome) return;
    if (!isNoResponse && (!responseDate || !responseDocumentUrl.trim())) {
      toast.error('A response date and document are required for this outcome.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        status: responseOutcome === 'deleted' ? 'resolved' : 'responded',
        outcome: responseOutcome,
        responseNotes,
        scoreImpact: scoreImpact ? Number(scoreImpact) : undefined,
      };

      if (!isNoResponse) {
        payload.responseChannel = responseChannel;
        payload.responseDocumentUrl = responseDocumentUrl.trim();
        payload.responseReceivedAt = responseDate;
      }

      const response = await fetch(`/api/admin/disputes/${dispute.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        toast.error(getErrorMessage(data, 'Failed to save response review'));
        return;
      }

      setRecommendation(getRecommendation(data));
      onResponseLogged();
      toast.success('Response review recorded.');
    } catch (error) {
      console.error('Error logging response:', error);
      toast.error('Failed to save response review');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRecommendedDraft = async () => {
    if (!dispute || recommendation?.kind !== 'create_next_draft') return;

    setCreatingDraft(true);
    try {
      const response = await fetch(`/api/admin/disputes/${dispute.id}/quick-redispute`, { method: 'POST' });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(getErrorMessage(data, 'Failed to create recommended draft'));
        return;
      }

      toast.success('Recommended draft created.');
      onResponseLogged();
      onClose();
    } catch (error) {
      console.error('Error creating recommended draft:', error);
      toast.error('Failed to create recommended draft');
    } finally {
      setCreatingDraft(false);
    }
  };

  return (
    <AnimatePresence>
      {open && dispute && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-4xl"
          >
            <Card className="border-border bg-card shadow-2xl">
              <CardHeader>
                <CardTitle>Review bureau response</CardTitle>
                <CardDescription>
                  {dispute.client_name} · {dispute.bureau.toUpperCase()} · Round {dispute.round}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <LetterStudio disputeId={dispute.id} initialLetter={dispute.letter_content} />

                {dispute.creditor_name && (
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-sm font-medium">{dispute.creditor_name}</p>
                    <p className="text-xs text-muted-foreground">{dispute.dispute_reason}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="response-outcome" className="text-sm font-medium">Response outcome *</label>
                  <select
                    id="response-outcome"
                    value={responseOutcome}
                    onChange={(event) => {
                      setResponseOutcome(event.target.value);
                      setRecommendation(null);
                    }}
                    className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {OUTCOME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                {isNoResponse ? (
                  <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                    <p className="text-sm font-medium text-foreground">No bureau response recorded</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Record this only after the recorded response deadline has elapsed. Do not add a fictitious receipt date, channel, or response document.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label htmlFor="response-date" className="text-sm font-medium">Response date *</label>
                      <Input
                        id="response-date"
                        type="date"
                        value={responseDate}
                        onChange={(event) => setResponseDate(event.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label htmlFor="response-channel" className="text-sm font-medium">Response channel</label>
                        <select
                          id="response-channel"
                          value={responseChannel}
                          onChange={(event) => setResponseChannel(event.target.value)}
                          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="mail">Mail</option>
                          <option value="online">Online portal</option>
                          <option value="email">Email</option>
                          <option value="phone">Phone</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="score-impact" className="text-sm font-medium">Score impact (points)</label>
                        <Input
                          id="score-impact"
                          type="number"
                          placeholder="e.g. 15"
                          value={scoreImpact}
                          onChange={(event) => setScoreImpact(event.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="response-document" className="text-sm font-medium">Response document URL *</label>
                      <Input
                        id="response-document"
                        type="url"
                        placeholder="https://..."
                        value={responseDocumentUrl}
                        onChange={(event) => setResponseDocumentUrl(event.target.value)}
                        className="mt-1"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">Upload the response to R2 and paste its secure URL for the audit trail.</p>
                    </div>
                  </>
                )}

                {isNoResponse && (
                  <div>
                    <label htmlFor="score-impact" className="text-sm font-medium">Score impact (points)</label>
                    <Input
                      id="score-impact"
                      type="number"
                      placeholder="e.g. 15"
                      value={scoreImpact}
                      onChange={(event) => setScoreImpact(event.target.value)}
                      className="mt-1"
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="response-notes" className="text-sm font-medium">Notes</label>
                  <textarea
                    id="response-notes"
                    value={responseNotes}
                    onChange={(event) => setResponseNotes(event.target.value)}
                    placeholder="Any details about this review..."
                    className="mt-1 min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                {recommendation && (
                  <div className="rounded-lg border border-secondary/30 bg-secondary/10 p-3" aria-live="polite">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Sparkles className="h-4 w-4 text-secondary" />
                      {recommendation.title}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{recommendation.detail}</p>
                    {recommendation.kind === 'create_next_draft' && (
                      <Button className="mt-3" size="sm" onClick={handleCreateRecommendedDraft} disabled={creatingDraft}>
                        {creatingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Create recommended draft
                      </Button>
                    )}
                  </div>
                )}

                {responseOutcome === 'deleted' && !recommendation && (
                  <div className="rounded-lg border border-success/30 bg-success/10 p-3">
                    <p className="flex items-center gap-2 text-sm text-success">
                      <CheckCircle2 className="h-4 w-4" />
                      The item will be marked as successfully removed.
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                  <Button className="flex-1" onClick={handleSubmitResponse} disabled={!responseOutcome || submitting}>
                    {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save response review
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

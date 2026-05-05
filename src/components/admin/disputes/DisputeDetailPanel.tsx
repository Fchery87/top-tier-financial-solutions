'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';

interface Dispute {
  id: string;
  client_id: string;
  client_name: string;
  bureau: string;
  dispute_reason: string;
  status: string;
  round: number;
  response_deadline: string | null;
  response_received_at: string | null;
  outcome: string | null;
  response_notes: string | null;
  response_document_url?: string | null;
  response_channel: string | null;
  score_impact: number | null;
  creditor_name: string | null;
}

const OUTCOME_OPTIONS = [
  { value: '', label: 'Select Outcome' },
  { value: 'deleted', label: 'Deleted ✓' },
  { value: 'verified', label: 'Verified (Escalate)' },
  { value: 'updated', label: 'Updated/Modified' },
  { value: 'no_response', label: 'No Response (30+ days)' },
  { value: 'frivolous', label: 'Marked Frivolous' },
];

interface DisputeDetailPanelProps {
  open: boolean;
  dispute: Dispute | null;
  onClose: () => void;
  onResponseLogged: () => void;
}

export function DisputeDetailPanel({ open, dispute, onClose, onResponseLogged }: DisputeDetailPanelProps) {
  const [responseOutcome, setResponseOutcome] = React.useState('');
  const [responseNotes, setResponseNotes] = React.useState('');
  const [responseDate, setResponseDate] = React.useState('');
  const [responseChannel, setResponseChannel] = React.useState('mail');
  const [responseDocumentUrl, setResponseDocumentUrl] = React.useState('');
  const [scoreImpact, setScoreImpact] = React.useState('');
  const [createNextRound, setCreateNextRound] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (dispute) {
      setResponseOutcome('');
      setResponseNotes('');
      setResponseDate(new Date().toISOString().split('T')[0]);
      setResponseChannel(dispute.response_channel || 'mail');
      setResponseDocumentUrl(dispute.response_document_url || '');
      setScoreImpact(dispute.score_impact !== null && dispute.score_impact !== undefined ? String(dispute.score_impact) : '');
      setCreateNextRound(true);
    }
  }, [dispute]);

  const handleSubmitResponse = async () => {
    if (!dispute || !responseOutcome) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/disputes/${dispute.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: responseOutcome === 'deleted' ? 'resolved' : 'responded',
          outcome: responseOutcome,
          responseNotes,
          responseChannel,
          responseDocumentUrl: responseDocumentUrl || undefined,
          scoreImpact: scoreImpact ? Number(scoreImpact) : undefined,
          responseReceivedAt: responseDate,
          createNextRound: responseOutcome === 'verified' && createNextRound,
          escalationReason: responseOutcome === 'verified' ? responseNotes : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        onClose();
        onResponseLogged();

        if (data.next_round_dispute) {
          toast.success(`Response logged! Round ${data.next_round_dispute.round} dispute created automatically.`);
        }
      }
    } catch (error) {
      console.error('Error logging response:', error);
      toast.error('Failed to log response');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && dispute && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg"
          >
            <Card className="bg-card border-border shadow-2xl">
              <CardHeader>
                <CardTitle>Log Bureau Response</CardTitle>
                <CardDescription>
                  {dispute.client_name} - {dispute.bureau.toUpperCase()} - Round {dispute.round}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {dispute.creditor_name && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-sm font-medium">{dispute.creditor_name}</p>
                    <p className="text-xs text-muted-foreground">{dispute.dispute_reason}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium">Response Outcome *</label>
                  <select
                    value={responseOutcome}
                    onChange={(e) => setResponseOutcome(e.target.value)}
                    className="w-full h-10 px-3 mt-1 rounded-md border border-input bg-background text-sm"
                  >
                    {OUTCOME_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">Response Date</label>
                  <Input
                    type="date"
                    value={responseDate}
                    onChange={(e) => setResponseDate(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Response Channel</label>
                    <select
                      value={responseChannel}
                      onChange={(e) => setResponseChannel(e.target.value)}
                      className="w-full h-10 px-3 mt-1 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="mail">Mail</option>
                      <option value="online">Online Portal</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Score Impact (pts)</label>
                    <Input
                      type="number"
                      placeholder="e.g. 15"
                      value={scoreImpact}
                      onChange={(e) => setScoreImpact(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Response Document URL (optional)</label>
                  <Input
                    type="url"
                    placeholder="https://..."
                    value={responseDocumentUrl}
                    onChange={(e) => setResponseDocumentUrl(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload responses to R2 and paste the secure URL here for audit trail.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <textarea
                    value={responseNotes}
                    onChange={(e) => setResponseNotes(e.target.value)}
                    placeholder="Any details about the response..."
                    className="w-full min-h-[80px] mt-1 px-3 py-2 text-sm rounded-md border border-input bg-background"
                  />
                </div>

                {responseOutcome === 'verified' && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={createNextRound}
                        onChange={(e) => setCreateNextRound(e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">
                        Auto-create Round {(dispute.round || 1) + 1} escalation dispute
                      </span>
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Will generate a Method of Verification letter for the next round.
                    </p>
                  </div>
                )}

                {responseOutcome === 'deleted' && (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                    <p className="text-sm text-green-600 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Item will be marked as successfully removed!
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleSubmitResponse}
                    disabled={!responseOutcome || submitting}
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Save Response
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

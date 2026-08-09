'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, Sparkles, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { LetterStudio } from '@/components/workspace/disputes/LetterStudio';
import { EvidencePacketPanel } from '@/components/workspace/disputes/EvidencePacketPanel';

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
  response_document_id?: string | null;
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

interface EvidenceDocument {
  id: string;
  file_name: string;
  file_type: string | null;
  created_at: string | null;
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

function getUploadedEvidenceDocument(payload: unknown): EvidenceDocument | null {
  if (
    typeof payload !== 'object'
    || payload === null
    || !('documents' in payload)
    || !Array.isArray(payload.documents)
  ) {
    return null;
  }

  const [document] = payload.documents;
  if (
    typeof document !== 'object'
    || document === null
    || !('id' in document)
    || !('file_name' in document)
    || typeof document.id !== 'string'
    || typeof document.file_name !== 'string'
  ) {
    return null;
  }

  return {
    id: document.id,
    file_name: document.file_name,
    file_type: 'file_type' in document && typeof document.file_type === 'string' ? document.file_type : null,
    created_at: 'created_at' in document && typeof document.created_at === 'string' ? document.created_at : null,
  };
}

function formatEvidenceDocumentLabel(document: EvidenceDocument): string {
  const uploadedOn = document.created_at
    ? new Date(document.created_at).toLocaleDateString()
    : 'upload date unavailable';
  return `${document.file_name} · ${document.file_type || 'other'} · ${uploadedOn}`;
}

export function DisputeDetailPanel({ open, dispute, onClose, onResponseLogged }: DisputeDetailPanelProps) {
  const [responseOutcome, setResponseOutcome] = React.useState('');
  const [responseNotes, setResponseNotes] = React.useState('');
  const [responseDate, setResponseDate] = React.useState('');
  const [responseChannel, setResponseChannel] = React.useState('mail');
  const [responseDocumentId, setResponseDocumentId] = React.useState('');
  const [evidenceDocuments, setEvidenceDocuments] = React.useState<EvidenceDocument[]>([]);
  const [loadingEvidence, setLoadingEvidence] = React.useState(false);
  const [uploadingEvidence, setUploadingEvidence] = React.useState(false);
  const [scoreImpact, setScoreImpact] = React.useState('');
  const [recommendation, setRecommendation] = React.useState<ResponseReviewRecommendation | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [creatingDraft, setCreatingDraft] = React.useState(false);
  const [showEvidencePacket, setShowEvidencePacket] = React.useState(false);

  React.useEffect(() => {
    if (dispute) {
      setResponseOutcome('');
      setResponseNotes('');
      setResponseDate(new Date().toISOString().split('T')[0]);
      setResponseChannel(dispute.response_channel || 'mail');
      setResponseDocumentId(dispute.response_document_id || '');
      setEvidenceDocuments([]);
      setScoreImpact(dispute.score_impact !== null && dispute.score_impact !== undefined ? String(dispute.score_impact) : '');
      setRecommendation(null);
      setShowEvidencePacket(false);
    }
  }, [dispute]);

  const isNoResponse = responseOutcome === 'no_response';

  React.useEffect(() => {
    if (!dispute || !responseOutcome || isNoResponse) {
      setEvidenceDocuments([]);
      setLoadingEvidence(false);
      return;
    }

    let cancelled = false;
    const loadEvidence = async () => {
      setLoadingEvidence(true);
      try {
        const response = await fetch(`/api/workspace/disputes/evidence?clientId=${encodeURIComponent(dispute.client_id)}`);
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(getErrorMessage(payload, 'Failed to load client evidence'));
        }
        if (
          !cancelled
          && typeof payload === 'object'
          && payload !== null
          && 'documents' in payload
          && Array.isArray(payload.documents)
        ) {
          const documents = payload.documents.filter((document): document is EvidenceDocument => (
            typeof document === 'object'
            && document !== null
            && 'id' in document
            && 'file_name' in document
            && typeof document.id === 'string'
            && typeof document.file_name === 'string'
            && (!('file_type' in document) || typeof document.file_type === 'string' || document.file_type === null)
            && (!('created_at' in document) || typeof document.created_at === 'string' || document.created_at === null)
          ));
          setEvidenceDocuments(documents);
        }
      } catch (error) {
        console.error('Error loading response evidence:', error);
        if (!cancelled) toast.error('Failed to load client evidence');
      } finally {
        if (!cancelled) setLoadingEvidence(false);
      }
    };

    void loadEvidence();
    return () => {
      cancelled = true;
    };
  }, [dispute, isNoResponse, responseOutcome]);

  const handleSubmitResponse = async () => {
    if (!dispute || !responseOutcome) return;
    if (!isNoResponse && (!responseDate || !responseDocumentId)) {
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
        payload.responseDocumentId = responseDocumentId;
        payload.responseReceivedAt = responseDate;
      }

      const response = await fetch(`/api/workspace/disputes/${dispute.id}`, {
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

  const handleEvidenceUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const [file] = Array.from(event.target.files || []);
    if (!dispute || !file) return;

    setUploadingEvidence(true);
    try {
      const formData = new FormData();
      formData.append('client_id', dispute.client_id);
      formData.append('file_type', 'correspondence');
      formData.append('file', file);
      const response = await fetch('/api/workspace/disputes/evidence/upload', {
        method: 'POST',
        body: formData,
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(getErrorMessage(payload, 'Failed to upload response evidence'));
      }
      const document = getUploadedEvidenceDocument(payload);
      if (!document) {
        throw new Error('The uploaded evidence document could not be read');
      }
      setEvidenceDocuments((documents) => [document, ...documents.filter((item) => item.id !== document.id)]);
      setResponseDocumentId(document.id);
      toast.success('Response evidence uploaded.');
    } catch (error) {
      console.error('Error uploading response evidence:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload response evidence');
    } finally {
      event.target.value = '';
      setUploadingEvidence(false);
    }
  };

  const handleCreateRecommendedDraft = async () => {
    if (!dispute || recommendation?.kind !== 'create_next_draft') return;

    setCreatingDraft(true);
    try {
      const response = await fetch(`/api/workspace/disputes/${dispute.id}/quick-redispute`, { method: 'POST' });
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

                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label htmlFor="response-document" className="text-sm font-medium">Response document *</label>
                        <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80">
                          {uploadingEvidence ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          Upload response evidence
                          <input
                            className="sr-only"
                            type="file"
                            accept="application/pdf,text/html,text/plain,image/jpeg,image/png,image/gif,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            onChange={handleEvidenceUpload}
                            disabled={uploadingEvidence}
                          />
                        </label>
                      </div>
                      <select
                        id="response-document"
                        value={responseDocumentId}
                        onChange={(event) => setResponseDocumentId(event.target.value)}
                        disabled={loadingEvidence || uploadingEvidence}
                        className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value="">{loadingEvidence ? 'Loading controlled evidence…' : 'Select a controlled document'}</option>
                        {evidenceDocuments.map((document) => (
                          <option key={document.id} value={document.id}>
                            {formatEvidenceDocumentLabel(document)}
                          </option>
                        ))}
                      </select>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Select an existing client-owned document or upload the bureau response. Files remain private controlled evidence.
                      </p>
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

                <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Evidence packet</p>
                      <p className="mt-1 text-xs text-muted-foreground">Create an attributable record from this client&apos;s controlled evidence.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-expanded={showEvidencePacket}
                      onClick={() => setShowEvidencePacket((visible) => !visible)}
                    >
                      {showEvidencePacket ? 'Close packet builder' : 'Build evidence packet'}
                    </Button>
                  </div>
                  {showEvidencePacket && (
                    <div className="mt-3">
                      <EvidencePacketPanel clientId={dispute.client_id} disputeId={dispute.id} />
                    </div>
                  )}
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

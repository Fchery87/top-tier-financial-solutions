'use client';

import * as React from 'react';
import { CheckCircle2, Clock, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { HIGH_RISK_CLAIM_STATEMENTS } from '@/lib/high-risk-claim-registry';
import { EvidenceDocumentPicker } from './EvidenceDocumentPicker';
import { bureauLabel, claimLabel } from './services/highRiskClaims';
import type { EvidenceDocument, HighRiskItemClaim } from './types';

interface HighRiskConfirmationPanelProps {
  claims: HighRiskItemClaim[];
  evidenceDocuments: EvidenceDocument[];
  onRequestConfirmation: (claim: HighRiskItemClaim, documentIds: string[]) => void;
  onRefresh: (claim: HighRiskItemClaim) => void;
  requestingKey?: string | null;
}

/**
 * One "Client confirmation" panel per high-risk claim on a selected item.
 * Staff attach supporting documents and ask the client; only the client can
 * confirm, in their portal.
 */
export function HighRiskConfirmationPanel({ claims, evidenceDocuments, onRequestConfirmation, onRefresh, requestingKey = null }: HighRiskConfirmationPanelProps) {
  if (claims.length === 0) return null;
  return (
    <div className="space-y-3">
      {claims.map(claim => (
        <ClaimPanel
          key={claim.key}
          claim={claim}
          evidenceDocuments={evidenceDocuments}
          onRequestConfirmation={onRequestConfirmation}
          onRefresh={onRefresh}
          requesting={requestingKey === claim.key}
        />
      ))}
    </div>
  );
}

function ClaimPanel({ claim, evidenceDocuments, onRequestConfirmation, onRefresh, requesting }: {
  claim: HighRiskItemClaim;
  evidenceDocuments: EvidenceDocument[];
  onRequestConfirmation: (claim: HighRiskItemClaim, documentIds: string[]) => void;
  onRefresh: (claim: HighRiskItemClaim) => void;
  requesting: boolean;
}) {
  const [documentIds, setDocumentIds] = React.useState<string[]>([]);
  const bureaus = bureauLabel(claim.bureau);
  const state = claim.confirmation.state;

  const toggle = (documentId: string) => setDocumentIds(prev => (
    prev.includes(documentId) ? prev.filter(id => id !== documentId) : [...prev, documentId]
  ));

  return (
    <section
      data-testid={`client-confirmation-${claim.key}`}
      aria-label={`Client confirmation for ${claim.itemLabel}`}
      className="space-y-3 rounded-lg border border-warning/30 bg-warning/5 p-4"
    >
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Client confirmation</p>
          <p className="text-sm text-foreground">
            {claim.itemLabel}{bureaus ? ` · ${bureaus}` : ''} · {claimLabel(claim.claimType)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">The client confirms: “{HIGH_RISK_CLAIM_STATEMENTS[claim.claimType]}”</p>
        </div>
      </div>

      {claim.loading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />Checking whether the client has confirmed…
        </p>
      ) : state === 'confirmed' ? (
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <CheckCircle2 data-testid="client-confirmed-check" className="h-4 w-4" aria-hidden="true" />Client confirmed
        </p>
      ) : state === 'awaiting_client_confirmation' ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Clock className="h-4 w-4 text-warning" aria-hidden="true" />Waiting for the client to confirm in their portal
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => onRefresh(claim)}>
            <RefreshCw className="mr-2 h-3 w-3" aria-hidden="true" />Refresh
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {state === 'missing_documents'
              ? 'The earlier request had no supporting documents. Pick the documents that support this claim and ask again.'
              : 'Pick the client documents that support this claim, then ask the client to confirm it in their portal.'}
          </p>
          {evidenceDocuments.length === 0 ? (
            <p className="text-xs text-muted-foreground">No documents uploaded for this client yet. Upload one below first.</p>
          ) : (
            <EvidenceDocumentPicker documents={evidenceDocuments} selectedIds={documentIds} onToggle={toggle} />
          )}
          <Button
            type="button"
            size="sm"
            disabled={documentIds.length === 0 || requesting}
            onClick={() => onRequestConfirmation(claim, documentIds)}
          >
            {requesting && <Loader2 className="mr-2 h-3 w-3 animate-spin" aria-hidden="true" />}Request client confirmation
          </Button>
        </div>
      )}
    </section>
  );
}

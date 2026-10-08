'use client';

import * as React from 'react';
import { AlertTriangle, FileCheck2, Loader2, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { HIGH_RISK_CLAIM_TYPES } from '@/lib/dispute-evidence';

interface EvidenceDocument {
  id: string;
  file_name: string;
  file_type: string | null;
  created_at: string | null;
}

interface EvidencePacket {
  id: string;
  claim_type: string;
  document_ids: string[];
  state: 'complete' | 'awaiting_client_confirmation';
  created_by_id: string | null;
  created_at: string | null;
}

interface EvidencePacketPanelProps {
  clientId: string;
  disputeId: string;
}

const CLAIM_TYPES = [
  { value: 'verification_required', label: 'Verification required' },
  { value: 'inaccurate_reporting', label: 'Inaccurate reporting' },
  { value: 'identity_theft', label: 'Identity theft' },
  { value: 'fraud', label: 'Fraud' },
  { value: 'not_mine', label: 'Not mine' },
  { value: 'never_late', label: 'Never late' },
  { value: 'unauthorized_inquiry', label: 'Unauthorized inquiry' },
];

function isEvidenceDocument(value: unknown): value is EvidenceDocument {
  return typeof value === 'object'
    && value !== null
    && 'id' in value
    && 'file_name' in value
    && typeof value.id === 'string'
    && typeof value.file_name === 'string'
    && (!('file_type' in value) || typeof value.file_type === 'string' || value.file_type === null)
    && (!('created_at' in value) || typeof value.created_at === 'string' || value.created_at === null);
}

function isEvidencePacket(value: unknown): value is EvidencePacket {
  return typeof value === 'object'
    && value !== null
    && 'id' in value
    && 'claim_type' in value
    && 'document_ids' in value
    && typeof value.id === 'string'
    && typeof value.claim_type === 'string'
    && Array.isArray(value.document_ids)
    && value.document_ids.every((id) => typeof id === 'string')
    && 'state' in value
    && (value.state === 'complete' || value.state === 'awaiting_client_confirmation')
    && (!('created_by_id' in value) || typeof value.created_by_id === 'string' || value.created_by_id === null)
    && (!('created_at' in value) || typeof value.created_at === 'string' || value.created_at === null);
}

function getErrorMessage(payload: unknown, fallback: string): string {
  return typeof payload === 'object'
    && payload !== null
    && 'error' in payload
    && typeof payload.error === 'string'
    ? payload.error
    : fallback;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : 'date unavailable';
}

export function EvidencePacketPanel({ clientId, disputeId }: EvidencePacketPanelProps) {
  const [documents, setDocuments] = React.useState<EvidenceDocument[]>([]);
  const [packets, setPackets] = React.useState<EvidencePacket[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = React.useState<string[]>([]);
  const [claimType, setClaimType] = React.useState('verification_required');
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadPackets = React.useCallback(async () => {
    const response = await fetch(
      `/api/workspace/evidence-packets?client_id=${encodeURIComponent(clientId)}&dispute_id=${encodeURIComponent(disputeId)}`,
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(getErrorMessage(payload, 'Failed to load evidence packets'));
    if (
      typeof payload === 'object'
      && payload !== null
      && 'packets' in payload
      && Array.isArray(payload.packets)
    ) {
      setPackets(payload.packets.filter(isEvidencePacket));
    }
  }, [clientId, disputeId]);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const evidenceResponse = await fetch(`/api/workspace/disputes/evidence?clientId=${encodeURIComponent(clientId)}`);
        const evidencePayload: unknown = await evidenceResponse.json().catch(() => null);
        if (!evidenceResponse.ok) {
          throw new Error(getErrorMessage(evidencePayload, 'Failed to load client evidence'));
        }
        if (
          !cancelled
          && typeof evidencePayload === 'object'
          && evidencePayload !== null
          && 'documents' in evidencePayload
          && Array.isArray(evidencePayload.documents)
        ) {
          setDocuments(evidencePayload.documents.filter(isEvidenceDocument));
        }
        if (!cancelled) await loadPackets();
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Failed to load evidence packets');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [clientId, loadPackets]);

  const isHighRisk = HIGH_RISK_CLAIM_TYPES.has(claimType);

  const toggleDocument = (documentId: string) => {
    setSelectedDocumentIds((selected) => (
      selected.includes(documentId)
        ? selected.filter((id) => id !== documentId)
        : [...selected, documentId]
    ));
  };

  const createPacket = async () => {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/workspace/evidence-packets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          dispute_id: disputeId,
          claim_type: claimType,
          document_ids: selectedDocumentIds,
          confirmations: [{ key: 'client_authorized_review', confirmed: true }],
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(getErrorMessage(payload, 'Failed to create evidence packet'));
      await loadPackets();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create evidence packet');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="border-border/80 bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PackageCheck className="h-4 w-4 text-primary" />
          Evidence packet
        </CardTitle>
        <CardDescription>
          Assemble a record of controlled client evidence for this dispute.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <div>
          <label htmlFor={`evidence-claim-${disputeId}`} className="text-sm font-medium">Claim type</label>
          <select
            id={`evidence-claim-${disputeId}`}
            value={claimType}
            onChange={(event) => setClaimType(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {CLAIM_TYPES.map((claim) => <option key={claim.value} value={claim.value}>{claim.label}</option>)}
          </select>
        </div>

        {isHighRisk && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" />Waiting for client confirmation</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The packet is saved and waiting for the client to confirm the factual claim in the portal. Letters and sending stay blocked until then.
            </p>
          </div>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Controlled evidence</legend>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading client evidence…</p>
          ) : documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No controlled evidence is available for this client.</p>
          ) : documents.map((document) => (
            <label key={document.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-border/70 px-3 py-2 text-sm hover:bg-muted/40">
              <input
                type="checkbox"
                checked={selectedDocumentIds.includes(document.id)}
                onChange={() => toggleDocument(document.id)}
                className="mt-0.5"
              />
              <span>
                <span className="block font-medium">{document.file_name}</span>
                <span className="block text-xs text-muted-foreground">{document.file_type || 'other'} · {formatDate(document.created_at)}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <Button onClick={createPacket} disabled={loading || creating || (isHighRisk && selectedDocumentIds.length === 0)} className="w-full">
          {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileCheck2 className="mr-2 h-4 w-4" />}
          Create evidence packet
        </Button>

        <div className="border-t border-border pt-3">
          <p className="text-sm font-medium">Packet history</p>
          {loading ? null : packets.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No evidence packets yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {packets.map((packet) => (
                <li key={packet.id} className="rounded-md bg-muted/40 px-3 py-2 text-xs">
                  <span className="font-medium">Packet {packet.id}</span>
                  {packet.state === 'awaiting_client_confirmation' && (
                    <span className="ml-2 font-medium text-amber-700">Awaiting client confirmation</span>
                  )}
                  <span className="ml-2 text-muted-foreground">{packet.claim_type} · {packet.document_ids.length} document{packet.document_ids.length === 1 ? '' : 's'} · {formatDate(packet.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

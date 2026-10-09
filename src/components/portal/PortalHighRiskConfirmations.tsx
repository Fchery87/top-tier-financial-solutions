'use client';

import * as React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';
import {
  HIGH_RISK_CLAIM_LABELS,
  HIGH_RISK_CLAIM_STATEMENTS,
  isDisputeItemKind,
  isHighRiskClaimType,
  type DisputeItemKind,
} from '@/lib/high-risk-claim-registry';

interface ClaimItem {
  kind: DisputeItemKind;
  name: string;
  bureaus: string[];
}

interface AwaitingPacket {
  id: string;
  claim_type: string;
  dispute_id: string | null;
  item: ClaimItem | null;
  created_at: string | null;
}

const BUREAU_NAMES: Record<string, string> = {
  transunion: 'TransUnion',
  experian: 'Experian',
  equifax: 'Equifax',
};

const ITEM_KIND_NAMES: Record<DisputeItemKind, string> = {
  tradeline: 'Account',
  inquiry: 'Credit inquiry',
  personal: 'Personal information',
};

function parseClaimItem(value: unknown): ClaimItem | null {
  if (typeof value !== 'object' || value === null) return null;
  const { kind, name, bureaus } = value as { kind?: unknown; name?: unknown; bureaus?: unknown };
  if (!isDisputeItemKind(kind) || typeof name !== 'string') return null;
  return {
    kind,
    name,
    bureaus: Array.isArray(bureaus) ? bureaus.filter((bureau): bureau is string => typeof bureau === 'string') : [],
  };
}

function isAwaitingPacket(value: unknown): value is AwaitingPacket {
  return typeof value === 'object'
    && value !== null
    && 'id' in value
    && 'claim_type' in value
    && typeof value.id === 'string'
    && typeof value.claim_type === 'string'
    && (!('dispute_id' in value) || typeof value.dispute_id === 'string' || value.dispute_id === null)
    && (!('created_at' in value) || typeof value.created_at === 'string' || value.created_at === null);
}

function claimLabel(claimType: string): string {
  return isHighRiskClaimType(claimType) ? HIGH_RISK_CLAIM_LABELS[claimType] : claimType.replaceAll('_', ' ');
}

function claimStatement(claimType: string): string | null {
  return isHighRiskClaimType(claimType) ? HIGH_RISK_CLAIM_STATEMENTS[claimType] : null;
}

function bureauNames(bureaus: string[]): string {
  return bureaus.map((bureau) => BUREAU_NAMES[bureau.toLowerCase()] ?? bureau).join(', ');
}

export default function PortalHighRiskConfirmations() {
  const [packets, setPackets] = React.useState<AwaitingPacket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch('/api/portal/high-risk-confirmations');
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok || cancelled) return;
        if (
          typeof payload === 'object'
          && payload !== null
          && 'packets' in payload
          && Array.isArray(payload.packets)
        ) {
          setPackets(payload.packets.filter(isAwaitingPacket).map((packet: AwaitingPacket & { item?: unknown }) => ({
            ...packet,
            item: parseClaimItem(packet.item),
          })));
        }
      } catch (error) {
        console.error('Error loading high-risk confirmations:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmPacket = async (packetId: string) => {
    const confirmationText = (drafts[packetId] ?? '').trim();
    if (!confirmationText) {
      toast.error('Enter your confirmation before submitting.');
      return;
    }
    setSubmittingId(packetId);
    try {
      const response = await fetch('/api/portal/high-risk-confirmations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          evidence_packet_id: packetId,
          confirmation_text: confirmationText,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof payload === 'object'
          && payload !== null
          && 'error' in payload
          && typeof payload.error === 'string'
          ? payload.error
          : 'Failed to record confirmation';
        toast.error(message);
        return;
      }
      setPackets((current) => current.filter((packet) => packet.id !== packetId));
    } catch (error) {
      console.error('Error confirming high-risk claim:', error);
      toast.error('Failed to record confirmation');
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading || packets.length === 0) return null;

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="font-display text-xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-warning" />
          Confirm factual claims
        </CardTitle>
        <CardDescription>
          These high-risk dispute claims need your confirmation before letters can be sent.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {packets.map((packet) => (
          <div key={packet.id} className="space-y-2 rounded-lg border border-border/60 bg-muted/40 p-3">
            <div className="space-y-1">
              {packet.item ? (
                <p className="text-sm font-medium text-foreground" data-testid={`confirmation-item-${packet.id}`}>
                  {ITEM_KIND_NAMES[packet.item.kind]}: {packet.item.name}
                  {packet.item.bureaus.length > 0 && (
                    <span className="font-normal text-muted-foreground"> · reported by {bureauNames(packet.item.bureaus)}</span>
                  )}
                </p>
              ) : null}
              <p className="text-sm text-foreground">
                <span className="font-medium">Claim:</span> {claimLabel(packet.claim_type)}
              </p>
              {claimStatement(packet.claim_type) && (
                <p className="text-sm text-muted-foreground">You are confirming: “{claimStatement(packet.claim_type)}”</p>
              )}
            </div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor={`confirm-${packet.id}`}>
              Confirm this factual claim in your own words
            </label>
            <textarea
              id={`confirm-${packet.id}`}
              value={drafts[packet.id] ?? ''}
              onChange={(event) => setDrafts((current) => ({ ...current, [packet.id]: event.target.value }))}
              className="min-h-20 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
            />
            <Button
              type="button"
              className="w-full"
              onClick={() => void confirmPacket(packet.id)}
              disabled={submittingId === packet.id || !(drafts[packet.id] ?? '').trim()}
            >
              {submittingId === packet.id ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
              ) : 'Confirm claim'}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

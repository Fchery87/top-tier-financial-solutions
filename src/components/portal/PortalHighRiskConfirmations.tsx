'use client';

import * as React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

interface AwaitingPacket {
  id: string;
  claim_type: string;
  dispute_id: string | null;
  created_at: string | null;
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
  return claimType.replaceAll('_', ' ');
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
          setPackets(payload.packets.filter(isAwaitingPacket));
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
            <p className="text-sm font-medium capitalize text-foreground">{claimLabel(packet.claim_type)}</p>
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

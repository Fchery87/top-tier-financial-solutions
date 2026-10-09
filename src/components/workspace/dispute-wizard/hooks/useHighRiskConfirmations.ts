import * as React from 'react';
import { toast } from 'sonner';
import type { ItemClaimConfirmation } from '@/lib/high-risk-claim-registry';
import type { HighRiskItemClaim } from '../types';
import { claimLabel, describeItem, itemKeyOfClaim, type HighRiskClaimTarget } from '../services/highRiskClaims';

interface ItemConfirmations {
  loading: boolean;
  claims: Record<string, ItemClaimConfirmation>;
}

function parseConfirmation(value: unknown): ItemClaimConfirmation | null {
  if (typeof value !== 'object' || value === null) return null;
  const { state, packetId } = value as { state?: unknown; packetId?: unknown };
  if (state === 'none') return { state: 'none' };
  if (typeof packetId !== 'string') return null;
  if (state === 'missing_documents' || state === 'awaiting_client_confirmation' || state === 'confirmed') {
    return { state, packetId };
  }
  return null;
}

function parseClaims(value: unknown): Record<string, ItemClaimConfirmation> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const claims: Record<string, ItemClaimConfirmation> = {};
  for (const [claimType, raw] of Object.entries(value)) {
    const confirmation = parseConfirmation(raw);
    if (confirmation) claims[claimType] = confirmation;
  }
  return claims;
}

function errorMessage(payload: unknown, fallback: string): string {
  return typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string'
    ? payload.error
    : fallback;
}

/**
 * Where the client's confirmation stands for each high-risk claim on the
 * selected items. Read from the evidence-packets GET filtered by client and
 * item; staff can request a confirmation but never record one.
 */
export function useHighRiskConfirmations({ clientId, targets }: { clientId: string | null | undefined; targets: HighRiskClaimTarget[] }) {
  // Keyed by `${clientId}|${itemKey}` so another client's answers never apply.
  const [byItem, setByItem] = React.useState<Record<string, ItemConfirmations>>({});
  const [requestingKey, setRequestingKey] = React.useState<string | null>(null);
  const requested = React.useRef(new Set<string>());

  const loadItem = React.useCallback(async (target: Pick<HighRiskClaimTarget, 'itemKind' | 'itemId'>) => {
    if (!clientId) return;
    const key = `${clientId}|${itemKeyOfClaim(target)}`;
    setByItem(prev => ({ ...prev, [key]: { loading: true, claims: prev[key]?.claims ?? {} } }));
    try {
      const params = new URLSearchParams({ client_id: clientId, item_kind: target.itemKind, item_id: target.itemId });
      const response = await fetch(`/api/workspace/evidence-packets?${params.toString()}`);
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(payload, 'Failed to load client confirmations'));
      const claims = parseClaims(typeof payload === 'object' && payload !== null && 'claims' in payload ? payload.claims : null);
      setByItem(prev => ({ ...prev, [key]: { loading: false, claims } }));
    } catch (error) {
      setByItem(prev => ({ ...prev, [key]: { loading: false, claims: prev[key]?.claims ?? {} } }));
      toast.error(error instanceof Error ? error.message : 'Failed to load client confirmations');
    }
  }, [clientId]);

  React.useEffect(() => {
    if (!clientId) return;
    for (const target of targets) {
      const key = `${clientId}|${itemKeyOfClaim(target)}`;
      if (requested.current.has(key)) continue;
      requested.current.add(key);
      void loadItem(target);
    }
  }, [clientId, targets, loadItem]);

  const confirmationFor = React.useCallback((target: HighRiskClaimTarget): HighRiskItemClaim => {
    const item = clientId ? byItem[`${clientId}|${itemKeyOfClaim(target)}`] : undefined;
    return { ...target, confirmation: item?.claims[target.claimType] ?? { state: 'none' }, loading: !item || item.loading };
  }, [byItem, clientId]);

  const claims = React.useMemo(() => targets.map(confirmationFor), [targets, confirmationFor]);

  const refreshClientConfirmation = React.useCallback((claim: Pick<HighRiskItemClaim, 'itemKind' | 'itemId'>) => {
    void loadItem(claim);
  }, [loadItem]);

  const requestClientConfirmation = React.useCallback(async (claim: HighRiskItemClaim, documentIds: string[]) => {
    if (!clientId || documentIds.length === 0) return;
    setRequestingKey(claim.key);
    try {
      const response = await fetch('/api/workspace/evidence-packets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          claim_type: claim.claimType,
          item_kind: claim.itemKind,
          item_id: claim.itemId,
          document_ids: documentIds,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(payload, 'Failed to request client confirmation'));
      toast.success(`Asked the client to confirm ${claimLabel(claim.claimType).toLowerCase()} for ${describeItem(claim.itemLabel, claim.bureau)} in their portal.`);
      await loadItem(claim);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to request client confirmation');
    } finally {
      setRequestingKey(null);
    }
  }, [clientId, loadItem]);

  return { claims, requestingKey, requestClientConfirmation, refreshClientConfirmation, confirmationFor };
}

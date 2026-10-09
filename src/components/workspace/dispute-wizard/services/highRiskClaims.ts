import {
  HIGH_RISK_CLAIM_LABELS,
  HIGH_RISK_CONFIRMATION_REQUIRED,
  isHighRiskClaimType,
  type HighRiskClaimBlocker,
  type HighRiskClaimType,
  type ItemClaimConfirmation,
} from '@/lib/high-risk-claim-registry';
import { BUREAUS, SECONDARY_BUREAUS, type DisputeItemKind, type DisputeItemPayload, type HighRiskItemClaim, type NegativeItem } from '../types';
import type { LetterGenerationBuilderInput, SelectedDisputeItemEntry } from '../types/letter-generation';
import { buildSelectedDisputeItems, disputeItemKey, entryReasonCodes } from './buildLetterGenerationPayload';

/** One (item, claim type) that needs the client's confirmation, before its state is known. */
export type HighRiskClaimTarget = Omit<HighRiskItemClaim, 'confirmation' | 'loading'>;

function tradelineBureaus(item: NegativeItem): string | null {
  const flagged = [
    item.on_transunion ? 'transunion' : null,
    item.on_experian ? 'experian' : null,
    item.on_equifax ? 'equifax' : null,
  ].filter((bureau): bureau is string => bureau !== null);
  if (flagged.length > 0) return flagged.join(',');
  if (item.bureaus && item.bureaus.length > 0) return item.bureaus.join(',');
  return item.bureau && item.bureau !== 'combined' ? item.bureau : null;
}

function entryLabel(entry: SelectedDisputeItemEntry): string {
  if (entry.kind === 'personal') return `${entry.payload.itemType?.replace('personal_info_', '').replaceAll('_', ' ') ?? 'Personal information'}: ${entry.payload.value ?? ''}`.trim();
  return entry.payload.creditorName || 'Unnamed item';
}

/** Every high-risk claim on the selected items, one per (item, claim type). */
export function highRiskClaimTargets(input: LetterGenerationBuilderInput): HighRiskClaimTarget[] {
  return buildSelectedDisputeItems(input).flatMap(entry => {
    const claimTypes = Array.from(new Set(entryReasonCodes(input, entry).filter(isHighRiskClaimType)));
    return claimTypes.map(claimType => ({
      key: `${disputeItemKey(entry.kind, entry.payload.id)}:${claimType}`,
      itemKind: entry.kind,
      itemId: entry.payload.id,
      itemLabel: entryLabel(entry),
      bureau: entry.kind === 'tradeline' ? tradelineBureaus(entry.raw as NegativeItem) : entry.payload.bureau ?? null,
      claimType,
    }));
  });
}

const ALL_BUREAUS: { code: string; label: string }[] = [...BUREAUS, ...SECONDARY_BUREAUS];

export function bureauLabel(bureau: string | null | undefined): string | null {
  if (!bureau) return null;
  return bureau
    .split(',')
    .map(code => code.trim())
    .filter(Boolean)
    .map(code => ALL_BUREAUS.find(entry => entry.code === code.toLowerCase())?.label ?? code)
    .join(', ');
}

/** "Bank One (Experian)" */
export function describeItem(itemLabel: string, bureau: string | null | undefined): string {
  const bureaus = bureauLabel(bureau);
  return bureaus ? `${itemLabel} (${bureaus})` : itemLabel;
}

export function claimLabel(claimType: HighRiskClaimType): string {
  return HIGH_RISK_CLAIM_LABELS[claimType];
}

function confirmationStateText(state: ItemClaimConfirmation['state'] | 'no_packet', loading = false): string {
  if (loading) return 'checking whether the client has confirmed';
  switch (state) {
    case 'none':
    case 'no_packet':
      return 'client confirmation has not been requested';
    case 'missing_documents':
      return 'the confirmation request has no supporting documents';
    case 'awaiting_client_confirmation':
      return 'waiting for the client to confirm in their portal';
    case 'confirmed':
      return 'confirmed by the client';
  }
}

export function isClaimBlocked(claim: HighRiskItemClaim): boolean {
  return claim.loading === true || claim.confirmation.state !== 'confirmed';
}

/** "Bank One (Experian), Not my account: waiting for the client to confirm in their portal" */
export function claimBlockerText(claim: HighRiskItemClaim): string {
  return `${describeItem(claim.itemLabel, claim.bureau)}, ${claimLabel(claim.claimType)}: ${confirmationStateText(claim.confirmation.state, claim.loading)}`;
}

/** The same words for the route's 409 per-item blockers, naming items from the request that was refused. */
export function routeBlockerText(blocker: HighRiskClaimBlocker, items: DisputeItemPayload[]): string {
  const item = items.find(candidate => candidate.id === blocker.itemId);
  const label = item ? describeItem(item.creditorName || item.value || 'Selected item', item.bureau) : 'An item in this letter';
  return `${label}, ${claimLabel(blocker.claimType)}: ${confirmationStateText(blocker.state)}`;
}

export function itemKeyOfClaim(claim: { itemKind: DisputeItemKind; itemId: string }): string {
  return disputeItemKey(claim.itemKind, claim.itemId);
}

function parseBlocker(value: unknown): HighRiskClaimBlocker | null {
  if (typeof value !== 'object' || value === null) return null;
  const { itemId, itemKind, claimType, state } = value as Record<string, unknown>;
  if (!isHighRiskClaimType(claimType)) return null;
  if (state !== 'no_packet' && state !== 'missing_documents' && state !== 'awaiting_client_confirmation') return null;
  return {
    itemId: typeof itemId === 'string' ? itemId : null,
    itemKind: itemKind === 'tradeline' || itemKind === 'personal' || itemKind === 'inquiry' ? itemKind : null,
    claimType,
    state,
  };
}

/** The generate route refused a letter because high-risk claims are not confirmed yet. */
export class HighRiskConfirmationRequiredError extends Error {
  readonly blockers: HighRiskClaimBlocker[];

  constructor(blockers: HighRiskClaimBlocker[], items: DisputeItemPayload[]) {
    super(`Client confirmation is needed. ${blockers.map(blocker => routeBlockerText(blocker, items)).join('; ')}.`);
    this.name = 'HighRiskConfirmationRequiredError';
    this.blockers = blockers;
  }

  /** The error for a 409 HIGH_RISK_CONFIRMATION_REQUIRED body, or null for any other body. */
  static fromResponse(status: number, payload: unknown, items: DisputeItemPayload[]): HighRiskConfirmationRequiredError | null {
    if (status !== 409 || typeof payload !== 'object' || payload === null) return null;
    const { code, items: rawBlockers } = payload as { code?: unknown; items?: unknown };
    if (code !== HIGH_RISK_CONFIRMATION_REQUIRED || !Array.isArray(rawBlockers)) return null;
    const blockers = rawBlockers.map(parseBlocker).filter((blocker): blocker is HighRiskClaimBlocker => blocker !== null);
    return blockers.length > 0 ? new HighRiskConfirmationRequiredError(blockers, items) : null;
  }
}

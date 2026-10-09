// Client-safe: the wizard and the portal import this, so it must not import the db.

/**
 * The single list of high-risk claim types. A high-risk claim on an item needs
 * that item's own evidence packet, confirmed by the client in the portal.
 */
export const HIGH_RISK_CLAIM_TYPE_LIST = [
  'identity_theft',
  'fraud',
  'not_mine',
  'never_late',
  'unauthorized_inquiry',
  'mixed_file',
] as const;

export type HighRiskClaimType = (typeof HIGH_RISK_CLAIM_TYPE_LIST)[number];

export const HIGH_RISK_CLAIM_TYPES: ReadonlySet<string> = new Set<string>(HIGH_RISK_CLAIM_TYPE_LIST);

export function isHighRiskClaimType(code: unknown): code is HighRiskClaimType {
  return typeof code === 'string' && HIGH_RISK_CLAIM_TYPES.has(code);
}

/** The claim in plain words, as staff and the client read it. */
export const HIGH_RISK_CLAIM_LABELS: Record<HighRiskClaimType, string> = {
  identity_theft: 'Identity theft',
  fraud: 'Fraud',
  not_mine: 'Not my account',
  never_late: 'Never late',
  unauthorized_inquiry: 'Unauthorized inquiry',
  mixed_file: 'Mixed credit file',
};

/** What the client is asked to confirm, in their own terms. */
export const HIGH_RISK_CLAIM_STATEMENTS: Record<HighRiskClaimType, string> = {
  identity_theft: 'This account was opened by someone who stole my identity.',
  fraud: 'This account or activity is fraudulent and I did not authorize it.',
  not_mine: 'This account does not belong to me. I never opened or authorized it.',
  never_late: 'I have never been late on this account.',
  unauthorized_inquiry: 'I did not apply for credit with this company or authorize this inquiry.',
  mixed_file: 'This information belongs to another person, not me.',
};

/** The high-risk claims that deny the consumer owns the item. */
export const OWNERSHIP_CLAIM_TYPES: readonly HighRiskClaimType[] = ['identity_theft', 'fraud', 'not_mine', 'mixed_file'];

export const DISPUTE_ITEM_KINDS = ['tradeline', 'personal', 'inquiry'] as const;

/** Which table a disputed item lives in: negative_items, personal_info_disputes or inquiry_disputes. */
export type DisputeItemKind = (typeof DISPUTE_ITEM_KINDS)[number];

export function isDisputeItemKind(value: unknown): value is DisputeItemKind {
  return typeof value === 'string' && (DISPUTE_ITEM_KINDS as readonly string[]).includes(value);
}

/** Where one (client, item, claim type) stands. Derived from evidence_packets rows only. */
export type ItemClaimConfirmation =
  | { state: 'none' }
  | { state: 'missing_documents'; packetId: string }
  | { state: 'awaiting_client_confirmation'; packetId: string }
  | { state: 'confirmed'; packetId: string };

export type HighRiskBlockerState = 'no_packet' | 'missing_documents' | 'awaiting_client_confirmation';

/** Why one item cannot carry a high-risk claim yet. `itemId` is null when the request named no item. */
export interface HighRiskClaimBlocker {
  itemId: string | null;
  itemKind: DisputeItemKind | null;
  claimType: HighRiskClaimType;
  state: HighRiskBlockerState;
}

export const HIGH_RISK_CONFIRMATION_REQUIRED = 'HIGH_RISK_CONFIRMATION_REQUIRED';

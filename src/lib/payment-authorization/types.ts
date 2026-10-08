import type { ComplianceGateCheckKey, ComplianceGateCheckRecord } from '@/lib/compliance-gate';

export type AuthorizationStatus = 'active' | 'revoked' | 'expired';

export type AccountType = 'checking' | 'savings';

export type AccountInputErrorCode =
  | 'BANK_NAME_REQUIRED'
  | 'ROUTING_NUMBER_INVALID'
  | 'ACCOUNT_NUMBER_INVALID'
  | 'ACCOUNT_TYPE_INVALID'
  | 'MAXIMUM_AMOUNT_INVALID'
  | 'SIGNATURE_REQUIRED';

export type AccountInputError = { code: AccountInputErrorCode };

export class AccountInputException extends Error {
  readonly code: AccountInputErrorCode;

  constructor(code: AccountInputErrorCode) {
    super(code);
    this.name = 'AccountInputException';
    this.code = code;
  }
}

export type PublicAuthorization = {
  id: string;
  clientId: string;
  status: AuthorizationStatus;
  bankName: string;
  accountLast4: string;
  accountType: AccountType;
  maximumAmountCents: number;
  signedAt: string;
  revokedAt: string | null;
  expiresAt: string | null;
};

export type ActiveAuthorization = {
  status: 'active';
  id: string;
  clientId: string;
  bankName: string;
  accountLast4: string;
  accountType: AccountType;
  maximumAmountCents: number;
  signedAt: Date;
  expiresAt: Date | null;
};

export type RevokedAuthorization = {
  status: 'revoked';
  id: string;
  clientId: string;
  bankName: string;
  accountLast4: string;
  accountType: AccountType;
  maximumAmountCents: number;
  signedAt: Date;
  revokedAt: Date;
  expiresAt: Date | null;
};

export type ExpiredAuthorization = {
  status: 'expired';
  id: string;
  clientId: string;
  bankName: string;
  accountLast4: string;
  accountType: AccountType;
  maximumAmountCents: number;
  signedAt: Date;
  expiresAt: Date;
};

export type Authorization = ActiveAuthorization | RevokedAuthorization | ExpiredAuthorization;

export type SealedAccount = {
  bankName: string;
  routingNumberEncrypted: string;
  accountNumberEncrypted: string;
  routingFingerprint: string;
  accountFingerprint: string;
  accountLast4: string;
  accountType: AccountType;
};

export type ChargeFacts = {
  authorization: ActiveAuthorization | null;
  invoiceStatus: 'draft' | 'pending' | 'paid' | 'void' | 'refunded';
  invoiceAmountCents: number;
  gateRecords: ComplianceGateCheckRecord[];
  hasQualifyingServicesRenderedEvent: boolean;
  feeModel: string | null;
  hasVerifiedResult: boolean;
  engagementStatus: string | null;
  engagementClosedAt: Date | null;
};

export type ChargeRefusal =
  | { outcome: 'blocked_no_authorization' }
  | { outcome: 'blocked_compliance_gate'; blockingChecks: ComplianceGateCheckKey[] }
  | { outcome: 'blocked_services_not_rendered' }
  | { outcome: 'blocked_results_not_verified' }
  | { outcome: 'blocked_above_cap'; invoiceAmountCents: number; maximumAmountCents: number }
  | { outcome: 'blocked_services_not_complete' }
  | { outcome: 'blocked_instrument' };

export const CHARGE_REFUSAL_COPY: Record<ChargeRefusal['outcome'], string> = {
  blocked_no_authorization: 'This client has not signed a payment authorization.',
  blocked_compliance_gate: 'The compliance gate has not passed.',
  blocked_services_not_rendered: 'A qualifying services-rendered event is required before collection.',
  blocked_results_not_verified: 'Result-based fees stay locked until the result is verified.',
  blocked_above_cap: 'This invoice is above the maximum the client signed.',
  blocked_services_not_complete:
    'Collection waits until the engagement is closed. Sending the first dispute package is not completion.',
  blocked_instrument:
    'Demand drafts are not a collection method. ACH debit needs a separate written NACHA authorization and a processor this app does not have. The invoice stays pending.',
};

export type SubmitResult =
  | { result: 'created'; authorization: ActiveAuthorization }
  | { result: 'unchanged'; authorization: ActiveAuthorization };

export type AuthorizationConflictError = { code: 'authorization_conflict' };

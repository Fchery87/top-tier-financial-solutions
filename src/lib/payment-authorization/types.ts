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

export type SubmitResult =
  | { result: 'created'; authorization: ActiveAuthorization }
  | { result: 'unchanged'; authorization: ActiveAuthorization };

export type AuthorizationConflictError = { code: 'authorization_conflict' };

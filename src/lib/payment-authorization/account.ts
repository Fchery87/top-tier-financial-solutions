import { createHash } from 'crypto';
import { encrypt } from '@/lib/encryption';
import { AccountInputException, type AccountType, type SealedAccount } from './types';

function digitsOnly(value: string): string {
  return value.replace(/\s+/g, '');
}

function passesAbaChecksum(routing: string): boolean {
  const digits = routing.split('').map((digit) => Number(digit));
  const sum =
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    (digits[2] + digits[5] + digits[8]);
  return sum % 10 === 0;
}

function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function sealAccount(input: {
  bankName: string;
  routingNumber: string;
  accountNumber: string;
  accountType: string;
}): SealedAccount {
  const bankName = input.bankName.trim();
  if (!bankName) {
    throw new AccountInputException('BANK_NAME_REQUIRED');
  }

  const routingNumber = digitsOnly(input.routingNumber);
  if (!/^\d{9}$/.test(routingNumber) || !passesAbaChecksum(routingNumber)) {
    throw new AccountInputException('ROUTING_NUMBER_INVALID');
  }

  const accountNumber = digitsOnly(input.accountNumber);
  if (!/^\d{4,17}$/.test(accountNumber)) {
    throw new AccountInputException('ACCOUNT_NUMBER_INVALID');
  }

  if (input.accountType !== 'checking' && input.accountType !== 'savings') {
    throw new AccountInputException('ACCOUNT_TYPE_INVALID');
  }

  const routingNumberEncrypted = encrypt(routingNumber);
  const accountNumberEncrypted = encrypt(accountNumber);
  if (!routingNumberEncrypted || !accountNumberEncrypted) {
    throw new AccountInputException('ROUTING_NUMBER_INVALID');
  }

  return {
    bankName,
    routingNumberEncrypted,
    accountNumberEncrypted,
    routingFingerprint: fingerprint(routingNumber),
    accountFingerprint: fingerprint(accountNumber),
    accountLast4: accountNumber.slice(-4),
    accountType: input.accountType as AccountType,
  };
}

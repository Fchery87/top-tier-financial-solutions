import { describe, expect, it } from 'vitest';
import { getAccountPresence } from '@/lib/credit-account-bureau-presence';
import type { ParsedAccount } from '@/lib/parsers/pdf-parser';

describe('credit account ingest bureau presence', () => {
  it('uses parser-provided bureau evidence for combined reports', () => {
    const account: ParsedAccount = {
      creditorName: 'Capital Bank',
      accountNumber: '***1111',
      accountType: 'Revolving',
      accountStatus: 'open',
      balance: 12345,
      isNegative: false,
      bureauEvidence: {
        transunion: {
          accountNumber: '***1111',
          balance: 12345,
          dateOpened: new Date('2020-01-15T00:00:00.000Z'),
        },
        equifax: {
          accountNumber: '***3333',
          balance: 45678,
          dateOpened: new Date('2021-02-20T00:00:00.000Z'),
        },
      },
    };

    expect(getAccountPresence(account, 'combined')).toEqual({
      onTransunion: true,
      onExperian: false,
      onEquifax: true,
      transunionDate: new Date('2020-01-15T00:00:00.000Z'),
      experianDate: undefined,
      equifaxDate: new Date('2021-02-20T00:00:00.000Z'),
      transunionBalance: 12345,
      experianBalance: undefined,
      equifaxBalance: 45678,
    });
  });

  it('does not imply all bureaus for combined reports without parser evidence', () => {
    const account: ParsedAccount = {
      creditorName: 'Capital Bank',
      accountNumber: '***1111',
      accountType: 'Revolving',
      accountStatus: 'open',
      balance: 12345,
      isNegative: false,
    };

    expect(getAccountPresence(account, 'combined')).toEqual({
      onTransunion: false,
      onExperian: false,
      onEquifax: false,
      transunionDate: undefined,
      experianDate: undefined,
      equifaxDate: undefined,
      transunionBalance: undefined,
      experianBalance: undefined,
      equifaxBalance: undefined,
    });
  });

  it('uses strong single-bureau basis when account bureau is parser-provided', () => {
    const account: ParsedAccount = {
      creditorName: 'Capital Bank',
      accountNumber: '***1111',
      accountType: 'Revolving',
      accountStatus: 'open',
      balance: 12345,
      bureau: 'experian',
      dateReported: new Date('2024-03-01T00:00:00.000Z'),
      isNegative: false,
    };

    expect(getAccountPresence(account, 'combined')).toEqual({
      onTransunion: false,
      onExperian: true,
      onEquifax: false,
      transunionDate: undefined,
      experianDate: new Date('2024-03-01T00:00:00.000Z'),
      equifaxDate: undefined,
      transunionBalance: undefined,
      experianBalance: 12345,
      equifaxBalance: undefined,
    });
  });
});

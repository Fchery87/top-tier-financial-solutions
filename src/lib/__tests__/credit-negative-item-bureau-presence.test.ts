import { describe, expect, it } from 'vitest';
import { getNegativeItemPresence } from '@/lib/credit-negative-item-bureau-presence';
import type { DerogatoryAccount, ParsedAccount, ParsedNegativeItem } from '@/lib/parsers/pdf-parser';

describe('negative item ingest bureau presence', () => {
  it('uses single-bureau derogatory evidence for combined reports', () => {
    const item: ParsedNegativeItem = {
      itemType: 'collection',
      creditorName: 'Capital Bank',
      riskSeverity: 'high',
    };

    const derogatoryMatch: DerogatoryAccount = {
      creditorName: 'Capital Bank',
      uniqueStatus: 'collection',
      transunion: {
        accountDate: '2024-02-01',
        accountStatus: 'collection',
      },
      experian: {},
      equifax: {
        accountDate: '-',
      },
    };

    expect(
      getNegativeItemPresence({
        item,
        reportBureau: 'combined',
        derogatoryMatch,
      })
    ).toEqual({
      onTransunion: true,
      onExperian: false,
      onEquifax: false,
      transunionDate: new Date('2024-02-01T00:00:00.000Z'),
      experianDate: undefined,
      equifaxDate: undefined,
      transunionStatus: 'collection',
      experianStatus: undefined,
      equifaxStatus: undefined,
    });
  });

  it('uses linked account evidence before guessing in combined reports', () => {
    const item: ParsedNegativeItem = {
      itemType: 'charge_off',
      creditorName: 'Capital Bank',
      riskSeverity: 'high',
    };

    const matchedAccount: ParsedAccount = {
      creditorName: 'Capital Bank',
      accountNumber: '***1111',
      accountType: 'Revolving',
      accountStatus: 'open',
      balance: 12345,
      isNegative: true,
      bureauEvidence: {
        experian: {
          accountNumber: '***1111',
          balance: 12345,
          dateReported: new Date('2024-03-01T00:00:00.000Z'),
        },
      },
    };

    expect(
      getNegativeItemPresence({
        item,
        reportBureau: 'combined',
        matchedAccount,
      })
    ).toEqual({
      onTransunion: false,
      onExperian: true,
      onEquifax: false,
      transunionDate: undefined,
      experianDate: new Date('2024-03-01T00:00:00.000Z'),
      equifaxDate: undefined,
    });
  });

  it('does not imply all bureaus for combined reports without evidence', () => {
    const item: ParsedNegativeItem = {
      itemType: 'collection',
      creditorName: 'Unknown Collector',
      riskSeverity: 'high',
    };

    expect(
      getNegativeItemPresence({
        item,
        reportBureau: 'combined',
      })
    ).toEqual({
      onTransunion: false,
      onExperian: false,
      onEquifax: false,
    });
  });
});

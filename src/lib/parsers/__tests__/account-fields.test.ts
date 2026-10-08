import { describe, expect, it } from 'vitest';
import { extractAccountFields } from '@/lib/parsers/account-fields';

describe('extractAccountFields', () => {
  it('reads original creditor, first delinquency, and estimated removal when the labels are present', () => {
    const block = `
      Creditor: Collection Agency
      Original Creditor: T-Mobile
      Date of First Delinquency: 01/2020
      Estimated date of removal: 01/2027
    `;

    const fields = extractAccountFields(block);

    expect(fields.originalCreditor).toBe('T-Mobile');
    expect(fields.dateOfFirstDelinquency?.toISOString()).toBe('2020-01-01T00:00:00.000Z');
    expect(fields.bureauStatedRemovalDate?.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(fields).not.toHaveProperty('paymentHistoryGrid');
  });

  it('leaves every field absent when the block has none of the labels', () => {
    const fields = extractAccountFields(`
      Creditor: Capital Bank
      Account Status: Open
      Balance: $100.00
    `);

    expect(fields).toEqual({});
  });
});

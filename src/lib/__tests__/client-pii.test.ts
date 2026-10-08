import { describe, expect, it } from 'vitest';

import { parseClientPii } from '@/lib/client-pii';

describe('parseClientPii', () => {
  it('requires name and email on create and trims them', () => {
    const result = parseClientPii({
      first_name: '  Ada ',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      ssn_last_4: '1234',
    }, 'create');

    expect(result).toEqual({
      ok: true,
      value: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        ssnLast4: '1234',
      },
    });
  });

  it('rejects a short SSN on update before any write', () => {
    const result = parseClientPii({ ssn_last_4: '12' }, 'update');

    expect(result).toEqual({ ok: false, error: 'SSN last 4 must be exactly 4 digits' });
  });

  it('rejects a non-string name', () => {
    const result = parseClientPii({ first_name: 4, last_name: 'Lovelace', email: 'ada@example.com' }, 'create');

    expect(result).toEqual({ ok: false, error: 'first_name must be a string' });
  });
});

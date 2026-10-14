import { beforeAll, describe, expect, it } from 'vitest';

describe('decryptClientName', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '07'.repeat(32);
  });

  it('returns the plain name for a name encrypted at rest', async () => {
    const { encryptClientData } = await import('@/lib/db-encryption');
    const { decryptClientName } = await import('@/lib/client-display-identity');
    const stored = encryptClientData({ firstName: 'Maria', lastName: 'Lopez' } as never);
    expect(stored.firstName).not.toBe('Maria');

    expect(decryptClientName(stored.firstName, stored.lastName)).toEqual({
      firstName: 'Maria',
      lastName: 'Lopez',
      fullName: 'Maria Lopez',
    });
  });

  it('passes through plain legacy names and tolerates missing parts', async () => {
    const { decryptClientName } = await import('@/lib/client-display-identity');

    expect(decryptClientName('Ana', null).fullName).toBe('Ana');
    expect(decryptClientName(undefined, undefined).fullName).toBe('');
  });
});

import { describe, expect, it } from 'vitest';
import { formatClientDisplayIdentity } from '@/lib/client-display-identity';

describe('formatClientDisplayIdentity', () => {
  it('returns only display-safe client identity fields', () => {
    expect(formatClientDisplayIdentity({
      firstName: 'Jane',
      lastName: 'Client',
      email: 'jane@example.com',
    })).toEqual({
      client_name: 'Jane Client',
      client_email: 'jane@example.com',
    });
  });
});

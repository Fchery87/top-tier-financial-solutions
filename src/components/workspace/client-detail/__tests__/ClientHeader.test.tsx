import { describe, expect, it } from 'vitest';
import { formatClientSince } from '../ClientHeader';

describe('formatClientSince', () => {
  it('does not invent an onboarding date when the client has not converted', () => {
    expect(formatClientSince(null)).toBe('Client since unavailable');
  });
});

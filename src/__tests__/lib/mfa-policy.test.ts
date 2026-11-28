import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decideMfaRequirement, isMfaRequiredForRole, shouldAdviseMfa } from '@/lib/mfa';

// These tests cover the mandatory-MFA mode, which is opt-in (see src/lib/mfa.ts).
vi.stubEnv('MFA_REQUIRED_FOR_TEAM', 'true');

describe('decideMfaRequirement', () => {
  it.each([
    ['staff', true, 'enrolled'],
    ['staff', false, 'enrollment_required'],
    ['admin', true, 'enrolled'],
    ['admin', false, 'enrollment_required'],
    ['super_admin', true, 'enrolled'],
    ['super_admin', false, 'enrollment_required'],
    ['user', true, 'enrolled'],
    ['user', false, 'not_required'],
    [null, true, 'enrolled'],
    [null, false, 'not_required'],
  ] as const)('role %s with twoFactorEnabled=%s -> %s', (role, twoFactorEnabled, expected) => {
    expect(decideMfaRequirement({ role, twoFactorEnabled })).toBe(expected);
  });

  it.each([null, undefined])('treats an unknown flag (%s) as not enrolled', (twoFactorEnabled) => {
    expect(decideMfaRequirement({ role: 'staff', twoFactorEnabled })).toBe('enrollment_required');
    expect(decideMfaRequirement({ role: 'user', twoFactorEnabled })).toBe('not_required');
  });

  it('does not treat an unknown role string as a team role', () => {
    expect(decideMfaRequirement({ role: 'owner', twoFactorEnabled: false })).toBe('not_required');
  });
});

describe('two-factor policy when it is optional (the default)', () => {
  beforeEach(() => { vi.stubEnv('MFA_REQUIRED_FOR_TEAM', ''); });
  afterEach(() => { vi.stubEnv('MFA_REQUIRED_FOR_TEAM', 'true'); });

  it.each(['staff', 'admin', 'super_admin', 'user', null])('does not require it for role %s', (role) => {
    expect(isMfaRequiredForRole(role)).toBe(false);
    expect(decideMfaRequirement({ role, twoFactorEnabled: false })).toBe('not_required');
    expect(decideMfaRequirement({ role, twoFactorEnabled: null })).toBe('not_required');
  });

  it('still reports enrolled users as enrolled', () => {
    expect(decideMfaRequirement({ role: 'staff', twoFactorEnabled: true })).toBe('enrolled');
  });

  it.each(['false', 'TRUE', '1', 'yes'])('only the exact value "true" turns enforcement on (%s does not)', (value) => {
    vi.stubEnv('MFA_REQUIRED_FOR_TEAM', value);
    expect(isMfaRequiredForRole('staff')).toBe(false);
  });

  it('advises everyone who has not enrolled, and nobody who has', () => {
    expect(shouldAdviseMfa(false)).toBe(true);
    expect(shouldAdviseMfa(null)).toBe(true);
    expect(shouldAdviseMfa(undefined)).toBe(true);
    expect(shouldAdviseMfa(true)).toBe(false);
  });
});

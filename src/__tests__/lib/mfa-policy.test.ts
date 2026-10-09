import { describe, expect, it } from 'vitest';
import { decideMfaRequirement } from '@/lib/mfa';

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

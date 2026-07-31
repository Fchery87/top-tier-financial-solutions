import { describe, it, expect } from 'vitest';
import { can, ROLE_CAPABILITIES } from '@/lib/capabilities';

describe('can', () => {
  it('lets staff work a case', () => {
    expect(can('staff', 'disputes:write')).toBe(true);
    expect(can('staff', 'clients:write')).toBe(true);
    expect(can('staff', 'letters:write')).toBe(true);
  });

  it('lets staff read templates but never write them', () => {
    expect(can('staff', 'templates:read')).toBe(true);
    expect(can('staff', 'templates:write')).toBe(false);
  });

  it('keeps business configuration away from staff', () => {
    expect(can('staff', 'settings:write')).toBe(false);
    expect(can('staff', 'content:write')).toBe(false);
    expect(can('staff', 'billing:system')).toBe(false);
  });

  it('gives admin configuration but not team management', () => {
    expect(can('admin', 'templates:write')).toBe(true);
    expect(can('admin', 'settings:write')).toBe(true);
    expect(can('admin', 'team:manage')).toBe(false);
  });

  it('gives super_admin every capability that exists', () => {
    for (const cap of ROLE_CAPABILITIES.super_admin) {
      expect(can('super_admin', cap)).toBe(true);
    }
    expect(can('super_admin', 'team:manage')).toBe(true);
  });

  it('gives plain users and null roles nothing', () => {
    expect(can('user', 'clients:read')).toBe(false);
    expect(can(null, 'clients:read')).toBe(false);
  });

  it('is monotonic: every staff capability is held by admin and super_admin', () => {
    for (const cap of ROLE_CAPABILITIES.staff) {
      expect(can('admin', cap)).toBe(true);
      expect(can('super_admin', cap)).toBe(true);
    }
  });
});

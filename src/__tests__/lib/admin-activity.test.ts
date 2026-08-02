import { describe, expect, it, vi } from 'vitest';

import { recordAdminActivity } from '@/lib/admin-activity';

describe('recordAdminActivity', () => {
  it('persists serializable metadata through the supplied executor', async () => {
    const values = vi.fn(async () => undefined);
    const executor = {
      insert: vi.fn(() => ({ values })),
    };

    await recordAdminActivity(executor, {
      actorUserId: 'actor-1',
      action: 'user_role.changed',
      subjectType: 'user_role',
      subjectId: 'target-1',
      metadata: { previousRole: 'admin', role: 'staff' },
    });

    expect(executor.insert).toHaveBeenCalledOnce();
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: 'actor-1',
      action: 'user_role.changed',
      subjectType: 'user_role',
      subjectId: 'target-1',
      metadata: JSON.stringify({ previousRole: 'admin', role: 'staff' }),
    }));
  });

  it('records system changes without an actor or optional subject fields', async () => {
    const values = vi.fn(async () => undefined);
    const executor = {
      insert: vi.fn(() => ({ values })),
    };

    await recordAdminActivity(executor, {
      actorUserId: null,
      action: 'settings.updated',
      subjectType: 'settings',
    });

    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: null,
      action: 'settings.updated',
      subjectType: 'settings',
      subjectId: null,
      metadata: null,
    }));
  });
});

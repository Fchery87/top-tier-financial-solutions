import { describe, expect, it } from 'vitest';

import {
  createChangeUserRole,
  parseTeamRoleMembers,
  type TeamRoleMember,
  type TeamRoleRepository,
} from '@/lib/team-role-management';

function createRepository(initialUsers: TeamRoleMember[]): {
  repository: TeamRoleRepository;
  users: TeamRoleMember[];
  audits: Array<{ actorUserId: string; targetUserId: string; previousRole: string; role: string }>;
} {
  const users = initialUsers.map((member) => ({ ...member }));
  const audits: Array<{ actorUserId: string; targetUserId: string; previousRole: string; role: string }> = [];
  let pendingTransaction = Promise.resolve();

  const repository: TeamRoleRepository = {
    async transaction(operation) {
      const previousTransaction = pendingTransaction;
      let releaseTransaction!: () => void;
      pendingTransaction = new Promise<void>((resolve) => {
        releaseTransaction = resolve;
      });

      await previousTransaction;
      try {
        return await operation({
          async lockTargetAndSuperAdmins(targetUserId) {
            const target = users.find((member) => member.id === targetUserId) ?? null;
            const superAdmins = users.filter((member) => member.role === 'super_admin');
            return {
              target: target ? { ...target } : null,
              superAdmins: superAdmins.map((member) => ({ ...member })),
            };
          },
          async applyRoleChange(input) {
            const target = users.find((member) => member.id === input.target.id);
            if (!target) throw new Error('Expected locked target to exist');

            target.role = input.role;
            audits.push({
              actorUserId: input.actorUserId,
              targetUserId: input.target.id,
              previousRole: input.target.role,
              role: input.role,
            });
          },
        });
      } finally {
        releaseTransaction();
      }
    },
  };

  return { repository, users, audits };
}

describe('changeUserRole', () => {
  it('accepts only complete, recognized role rows from the database boundary', () => {
    expect(parseTeamRoleMembers([
      { id: 'owner-1', email: 'owner@example.com', role: 'super_admin' },
      { id: 'missing-email', role: 'admin' },
      { id: 'unknown-role', email: 'unknown@example.com', role: 'owner' },
    ])).toEqual([
      { id: 'owner-1', email: 'owner@example.com', role: 'super_admin' },
    ]);
  });

  it('rejects a runtime role outside the supported user-role set', async () => {
    const { repository } = createRepository([]);
    const changeUserRole = createChangeUserRole(repository);

    await expect(changeUserRole({
      actorUserId: 'actor-1',
      targetUserId: 'target-1',
      role: 'owner',
    })).resolves.toEqual({ ok: false, code: 'invalid_role' });
  });

  it('returns not_found without mutating when the target does not exist', async () => {
    const { repository, audits } = createRepository([]);
    const changeUserRole = createChangeUserRole(repository);

    await expect(changeUserRole({
      actorUserId: 'actor-1',
      targetUserId: 'missing',
      role: 'admin',
    })).resolves.toEqual({ ok: false, code: 'not_found' });

    expect(audits).toEqual([]);
  });

  it('prevents demoting the final super admin', async () => {
    const { repository, users, audits } = createRepository([
      { id: 'owner-1', email: 'owner@example.com', role: 'super_admin' },
    ]);
    const changeUserRole = createChangeUserRole(repository);

    await expect(changeUserRole({
      actorUserId: 'owner-1',
      targetUserId: 'owner-1',
      role: 'admin',
    })).resolves.toEqual({ ok: false, code: 'last_super_admin' });

    expect(users[0]?.role).toBe('super_admin');
    expect(audits).toEqual([]);
  });

  it('updates the role and records the old and new role for audit', async () => {
    const { repository, users, audits } = createRepository([
      { id: 'owner-1', email: 'owner@example.com', role: 'super_admin' },
      { id: 'member-1', email: 'member@example.com', role: 'staff' },
    ]);
    const changeUserRole = createChangeUserRole(repository);

    await expect(changeUserRole({
      actorUserId: 'owner-1',
      targetUserId: 'member-1',
      role: 'admin',
    })).resolves.toEqual({
      ok: true,
      userId: 'member-1',
      email: 'member@example.com',
      previousRole: 'staff',
      role: 'admin',
    });

    expect(users[1]?.role).toBe('admin');
    expect(audits).toEqual([{
      actorUserId: 'owner-1',
      targetUserId: 'member-1',
      previousRole: 'staff',
      role: 'admin',
    }]);
  });

  it('allows only one of two concurrent final-super-admin demotions', async () => {
    const { repository, users } = createRepository([
      { id: 'owner-1', email: 'owner-1@example.com', role: 'super_admin' },
      { id: 'owner-2', email: 'owner-2@example.com', role: 'super_admin' },
    ]);
    const changeUserRole = createChangeUserRole(repository);

    const results = await Promise.all([
      changeUserRole({ actorUserId: 'owner-1', targetUserId: 'owner-1', role: 'admin' }),
      changeUserRole({ actorUserId: 'owner-2', targetUserId: 'owner-2', role: 'admin' }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, code: 'last_super_admin' },
    ]);
    expect(users.filter((member) => member.role === 'super_admin')).toHaveLength(1);
  });
});

import { recordAdminActivity } from '@/lib/admin-activity';
import type { UserRole } from '@/lib/admin-auth';

export interface TeamRoleMember {
  id: string;
  email: string;
  role: UserRole;
}

export type ChangeRoleResult =
  | {
    ok: true;
    userId: string;
    email: string;
    previousRole: UserRole;
    role: UserRole;
  }
  | { ok: false; code: 'not_found' | 'last_super_admin' | 'invalid_role' };

export interface ChangeRoleInput {
  actorUserId: string;
  targetUserId: string;
  role: string;
}

export interface TeamRoleTransaction {
  lockTargetAndSuperAdmins(targetUserId: string): Promise<{
    target: TeamRoleMember | null;
    superAdmins: TeamRoleMember[];
  }>;
  applyRoleChange(input: {
    actorUserId: string;
    target: TeamRoleMember;
    role: UserRole;
  }): Promise<void>;
}

export interface TeamRoleRepository {
  transaction<T>(operation: (transaction: TeamRoleTransaction) => Promise<T>): Promise<T>;
}

const userRoles = new Set<string>(['user', 'staff', 'admin', 'super_admin']);

function isUserRole(role: string): role is UserRole {
  return userRoles.has(role);
}

function isTeamRoleMember(value: unknown): value is TeamRoleMember {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return 'id' in value
    && 'email' in value
    && 'role' in value
    && typeof value.id === 'string'
    && typeof value.email === 'string'
    && typeof value.role === 'string'
    && isUserRole(value.role);
}

export function parseTeamRoleMembers(rows: readonly unknown[]): TeamRoleMember[] {
  return rows.filter(isTeamRoleMember);
}

export function createChangeUserRole(repository: TeamRoleRepository) {
  return async function changeUserRole(input: ChangeRoleInput): Promise<ChangeRoleResult> {
    if (!isUserRole(input.role)) {
      return { ok: false, code: 'invalid_role' };
    }
    const role = input.role;

    return repository.transaction(async (transaction) => {
      const { target, superAdmins } = await transaction.lockTargetAndSuperAdmins(input.targetUserId);
      if (!target) {
        return { ok: false, code: 'not_found' };
      }

      const wouldRemoveFinalSuperAdmin =
        target.role === 'super_admin'
        && input.role !== 'super_admin'
        && superAdmins.length === 1;

      if (wouldRemoveFinalSuperAdmin) {
        return { ok: false, code: 'last_super_admin' };
      }

      await transaction.applyRoleChange({
        actorUserId: input.actorUserId,
        target,
        role,
      });

      return {
        ok: true,
        userId: target.id,
        email: target.email,
        previousRole: target.role,
        role,
      };
    });
  };
}

const databaseRoleRepository: TeamRoleRepository = {
  async transaction<T>(operation: (transaction: TeamRoleTransaction) => Promise<T>): Promise<T> {
    const [{ db }, { sql }] = await Promise.all([
      import('@/db/client'),
      import('drizzle-orm'),
    ]);

    return db.transaction(async (tx) => operation({
      async lockTargetAndSuperAdmins(targetUserId) {
        const result = await tx.execute(sql<TeamRoleMember>`
          SELECT id, email, role
          FROM "user"
          WHERE id = ${targetUserId} OR role = 'super_admin'
          FOR UPDATE
        `);
        const members = parseTeamRoleMembers(result.rows);

        return {
          target: members.find((member) => member.id === targetUserId) ?? null,
          superAdmins: members.filter((member) => member.role === 'super_admin'),
        };
      },
      async applyRoleChange({ actorUserId, target, role }) {
        await tx.execute(sql`
          UPDATE "user"
          SET role = ${role}, updated_at = NOW()
          WHERE id = ${target.id}
        `);

        await recordAdminActivity(tx, {
          actorUserId,
          action: 'user_role.changed',
          subjectType: 'user_role',
          subjectId: target.id,
          metadata: {
            previousRole: target.role,
            role,
          },
        });
      },
    }));
  },
};

export const changeUserRole = createChangeUserRole(databaseRoleRepository);

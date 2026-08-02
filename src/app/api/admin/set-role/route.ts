import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { auth } from '@/lib/auth';
import { requireCapability } from '@/lib/admin-session';
import { changeUserRole } from '@/lib/team-role-management';

interface RoleRequest {
  email: string;
  role: string;
}

interface RoleTarget {
  id: string;
  email: string;
}

function isRoleRequest(value: unknown): value is RoleRequest {
  return typeof value === 'object'
    && value !== null
    && 'email' in value
    && 'role' in value
    && typeof value.email === 'string'
    && value.email.length > 0
    && typeof value.role === 'string';
}

function parseCount(rows: readonly unknown[]): number | null {
  const first = rows[0];
  if (typeof first !== 'object' || first === null || !('count' in first)) return null;
  if (typeof first.count === 'number' && Number.isInteger(first.count) && first.count >= 0) return first.count;
  if (typeof first.count === 'string' && /^\d+$/.test(first.count)) return Number(first.count);
  return null;
}

function parseRoleTarget(rows: readonly unknown[]): RoleTarget | null {
  const first = rows[0];
  if (typeof first !== 'object' || first === null) return null;
  if (!('id' in first) || !('email' in first)) return null;
  if (typeof first.id !== 'string' || typeof first.email !== 'string') return null;
  return { id: first.id, email: first.email };
}

function roleChangeResponse(result: Awaited<ReturnType<typeof changeUserRole>>) {
  if (result.ok) {
    return NextResponse.json({ success: true, user: result });
  }

  const status = {
    invalid_role: 400,
    not_found: 404,
    last_super_admin: 409,
  }[result.code];
  return NextResponse.json({ success: false, error: result.code }, { status });
}

// Backward-compatible endpoint. New role changes belong to /api/admin/team.
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isRoleRequest(body)) {
    return NextResponse.json({ success: false, error: 'Email and role are required' }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const superAdminResult = await db.execute(sql`SELECT COUNT(*) AS count FROM "user" WHERE role = 'super_admin'`);
  const superAdminCount = parseCount(superAdminResult.rows);
  if (superAdminCount === null) {
    return NextResponse.json({ success: false, error: 'Unable to verify super-admin state' }, { status: 500 });
  }

  const normalizedEmail = body.email.trim().toLowerCase();
  const normalizedSessionEmail = session.user.email.trim().toLowerCase();
  const isBootstrap = superAdminCount === 0;

  if (isBootstrap && (body.role !== 'super_admin' || normalizedEmail !== normalizedSessionEmail)) {
    return NextResponse.json(
      { success: false, error: 'First super_admin bootstrap requires signed-in user promoting own account' },
      { status: 403 },
    );
  }

  if (!isBootstrap) {
    const adminUser = await requireCapability('team:manage');
    if (!adminUser) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
  }

  const targetResult = await db.execute(sql`
    SELECT id, email
    FROM "user"
    WHERE LOWER(email) = ${normalizedEmail}
    LIMIT 1
  `);
  const target = parseRoleTarget(targetResult.rows);
  if (!target) {
    return NextResponse.json({ success: false, error: 'User not found. Role can only be assigned to existing users.' }, { status: 404 });
  }

  if (isBootstrap && target.id !== session.user.id) {
    return NextResponse.json(
      { success: false, error: 'First super_admin bootstrap requires signed-in user promoting own account' },
      { status: 403 },
    );
  }

  return roleChangeResponse(await changeUserRole({
    actorUserId: session.user.id,
    targetUserId: target.id,
    role: body.role,
  }));
}

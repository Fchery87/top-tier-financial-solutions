import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { requireCapability } from '@/lib/admin-session';
import { changeUserRole } from '@/lib/team-role-management';

interface TeamMemberResponse {
  id: string;
  email: string;
  name: string;
  role: 'staff' | 'admin' | 'super_admin';
  last_active_at: string | null;
  is_last_super_admin: boolean;
}

interface AdminActivityResponse {
  id: string;
  action: string;
  subject_type: string;
  subject_id: string | null;
  actor_name: string | null;
  created_at: string;
}

function toIsoString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

function parseTeamMembers(rows: readonly unknown[]): TeamMemberResponse[] {
  return rows.flatMap((row) => {
    if (typeof row !== 'object' || row === null) return [];
    if (!('id' in row) || !('email' in row) || !('name' in row) || !('role' in row)) return [];
    if (typeof row.id !== 'string' || typeof row.email !== 'string' || typeof row.name !== 'string') return [];
    if (row.role !== 'staff' && row.role !== 'admin' && row.role !== 'super_admin') return [];

    return [{
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      last_active_at: 'last_active_at' in row ? toIsoString(row.last_active_at) : null,
      is_last_super_admin: false,
    }];
  });
}

function parseRecentActivity(rows: readonly unknown[]): AdminActivityResponse[] {
  return rows.flatMap((row) => {
    if (typeof row !== 'object' || row === null) return [];
    if (!('id' in row) || !('action' in row) || !('subject_type' in row) || !('created_at' in row)) return [];
    const createdAt = toIsoString(row.created_at);
    if (typeof row.id !== 'string' || typeof row.action !== 'string' || typeof row.subject_type !== 'string' || !createdAt) return [];

    return [{
      id: row.id,
      action: row.action,
      subject_type: row.subject_type,
      subject_id: 'subject_id' in row && typeof row.subject_id === 'string' ? row.subject_id : null,
      actor_name: 'actor_name' in row && typeof row.actor_name === 'string' ? row.actor_name : null,
      created_at: createdAt,
    }];
  });
}

function isRoleUpdateRequest(value: unknown): value is { user_id: string; role: string } {
  return typeof value === 'object'
    && value !== null
    && 'user_id' in value
    && 'role' in value
    && typeof value.user_id === 'string'
    && value.user_id.length > 0
    && typeof value.role === 'string';
}

export async function GET() {
  const adminUser = await requireCapability('team:manage');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await db.execute(sql`
    SELECT
      u.id,
      u.email,
      u.name,
      u.role,
      MAX(s.updated_at) AS last_active_at
    FROM "user" AS u
    LEFT JOIN "session" AS s ON s.user_id = u.id
    WHERE u.role IN ('staff', 'admin', 'super_admin')
    GROUP BY u.id, u.email, u.name, u.role
    ORDER BY u.name ASC, u.email ASC
  `);
  const activityResult = await db.execute(sql`
    SELECT
      activity.id,
      activity.action,
      activity.subject_type,
      activity.subject_id,
      COALESCE(actor.name, actor.email) AS actor_name,
      activity.created_at
    FROM admin_activity_log AS activity
    LEFT JOIN "user" AS actor ON actor.id = activity.actor_user_id
    ORDER BY activity.created_at DESC
    LIMIT 10
  `);

  const members = parseTeamMembers(result.rows);
  const superAdminCount = members.filter((member) => member.role === 'super_admin').length;

  return NextResponse.json({
    members: members.map((member) => ({
      ...member,
      is_last_super_admin: member.role === 'super_admin' && superAdminCount === 1,
    })),
    recent_activity: parseRecentActivity(activityResult.rows),
  });
}

export async function PATCH(request: NextRequest) {
  const adminUser = await requireCapability('team:manage');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isRoleUpdateRequest(body)) {
    return NextResponse.json({ error: 'user_id and role are required' }, { status: 400 });
  }

  const result = await changeUserRole({
    actorUserId: adminUser.id,
    targetUserId: body.user_id,
    role: body.role,
  });

  if (result.ok) {
    return NextResponse.json({ member: result });
  }

  const status = {
    invalid_role: 400,
    not_found: 404,
    last_super_admin: 409,
  }[result.code];

  return NextResponse.json({ error: result.code }, { status });
}

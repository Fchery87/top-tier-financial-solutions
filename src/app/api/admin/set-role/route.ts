import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminSessionUser } from '@/lib/admin-session';

// This endpoint allows setting user roles
export async function POST(request: NextRequest) {
  try {
    const { email, role } = await request.json();

    // Count existing super_admins
    const superAdminCount = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.role, 'super_admin'));

    const requester = await getAdminSessionUser('super_admin');
    const isFirstSuperAdmin = superAdminCount.length === 0;

    if (!requester && !isFirstSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only super_admin can modify roles' },
        { status: 401 }
      );
    }

    if (!email || !role) {
      return NextResponse.json(
        { success: false, error: 'Email and role are required' },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = ['user', 'admin', 'super_admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role. Must be: user, admin, or super_admin' },
        { status: 400 }
      );
    }

    // Bootstrap rule: when no super admin exists, requester can only set their own role to super_admin.
    if (
      isFirstSuperAdmin &&
      (!requester || requester.email.toLowerCase() !== String(email).toLowerCase() || role !== 'super_admin')
    ) {
      return NextResponse.json(
        { success: false, error: 'First super_admin bootstrap requires signed-in user promoting own account' },
        { status: 403 }
      );
    }

    // Update user role
    const result = await db
      .update(user)
      .set({ role })
      .where(eq(user.email, email))
      .returning({ email: user.email, role: user.role });

    if (result.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User not found. Role can only be assigned to existing users.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Role updated successfully',
      user: result[0],
    });
  } catch (error) {
    console.error('Error setting user role:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';

// This endpoint allows setting user roles
// Protected by requiring requester email to be super_admin (or first setup)
export async function POST(request: NextRequest) {
  try {
    const { email, role, requesterEmail } = await request.json();

    if (!requesterEmail) {
      return NextResponse.json(
        { success: false, error: 'Requester email is required' },
        { status: 401 }
      );
    }

    // Check if requester is super_admin (skip for first super_admin setup)
    const requesterRole = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.email, requesterEmail))
      .limit(1);

    // Count existing super_admins
    const superAdminCount = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.role, 'super_admin'));

    // Allow first super_admin to be created without authorization
    const isFirstSuperAdmin = superAdminCount.length === 0;
    const isRequesterSuperAdmin = requesterRole.length > 0 && requesterRole[0].role === 'super_admin';

    if (!isFirstSuperAdmin && !isRequesterSuperAdmin) {
      return NextResponse.json(
        { success: false, error: 'Only super_admin can modify roles' },
        { status: 403 }
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

    // Update user role
    const result = await db
      .update(user)
      .set({ role })
      .where(eq(user.email, email))
      .returning({ email: user.email, role: user.role });

    if (result.length === 0) {
      // User doesn't exist, create them
      const newUser = await db
        .insert(user)
        .values({ id: crypto.randomUUID(), name: email.split('@')[0], email, role })
        .returning({ email: user.email, role: user.role });

      return NextResponse.json({
        success: true,
        message: 'User created with role',
        user: newUser[0],
      });
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

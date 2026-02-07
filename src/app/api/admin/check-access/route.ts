import { NextResponse } from 'next/server';
import { getAdminSessionUser } from '@/lib/admin-session';

export async function POST() {
  try {
    const user = await getAdminSessionUser('super_admin');
    if (!user) {
      return NextResponse.json({ authorized: false, role: null }, { status: 401 });
    }

    return NextResponse.json({
      authorized: true,
      role: user.role,
      user_id: user.id,
      user_email: user.email,
    });
  } catch (error) {
    console.error('Error checking admin access:', error);
    return NextResponse.json(
      { authorized: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

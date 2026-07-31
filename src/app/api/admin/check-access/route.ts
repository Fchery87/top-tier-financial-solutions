import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/admin-auth';
import { isTeamRole, ROLE_CAPABILITIES } from '@/lib/capabilities';

export async function POST() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.email) {
      return NextResponse.json({ authorized: false, role: null, capabilities: [] }, { status: 401 });
    }

    const role = await getUserRole(session.user.email);
    if (!isTeamRole(role)) {
      return NextResponse.json({ authorized: false, role: null, capabilities: [] }, { status: 403 });
    }

    return NextResponse.json({
      authorized: true,
      role,
      capabilities: ROLE_CAPABILITIES[role],
      user_id: session.user.id,
      user_email: session.user.email,
    });
  } catch (error) {
    console.error('Error checking admin access:', error);
    return NextResponse.json(
      { authorized: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

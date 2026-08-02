import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserRole } from '@/lib/admin-auth';
import { isTeamRole } from '@/lib/capabilities';

function isInternalPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) return NextResponse.json({ landing: '/sign-in' }, { status: 401 });

  const role = await getUserRole(session.user.email);
  const requested = request.nextUrl.searchParams.get('next');
  if (isTeamRole(role)) {
    const landing = requested && isInternalPath(requested) ? requested : '/workspace';
    return NextResponse.json({ landing });
  }

  return NextResponse.json({ landing: '/portal' });
}

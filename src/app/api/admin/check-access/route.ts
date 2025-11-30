import { NextRequest, NextResponse } from 'next/server';
import { isSuperAdmin } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { authorized: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    const authorized = await isSuperAdmin(email);

    return NextResponse.json({ authorized });
  } catch (error) {
    console.error('Error checking admin access:', error);
    return NextResponse.json(
      { authorized: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

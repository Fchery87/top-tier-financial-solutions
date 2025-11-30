import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { analyzeCreditReport } from '@/lib/credit-analysis';

async function validateAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.email) {
    return null;
  }
  
  const isAdmin = await isSuperAdmin(session.user.email);
  if (!isAdmin) {
    return null;
  }
  
  return session.user;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await analyzeCreditReport(id);
    return NextResponse.json({ success: true, message: 'Credit report analyzed successfully' });
  } catch (error) {
    console.error('Error parsing credit report:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to parse credit report' },
      { status: 500 }
    );
  }
}

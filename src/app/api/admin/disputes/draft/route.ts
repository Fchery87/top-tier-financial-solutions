import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';

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

// Persisting drafts to DB is optional. We accept and acknowledge the payload
// so client-side localStorage auto-save doesn't fail.
export async function POST(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    return NextResponse.json({ success: true, draftId: body?.draftId ?? null });
  } catch {
    return NextResponse.json({ error: 'Invalid draft payload' }, { status: 400 });
  }
}

export async function DELETE() {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // No-op delete: localStorage is the source of truth for now.
  return NextResponse.json({ success: true });
}


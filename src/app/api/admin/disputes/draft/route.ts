import { NextRequest, NextResponse } from 'next/server';
import { requireCapability } from '@/lib/admin-session';

// Persisting drafts to DB is optional. We accept and acknowledge the payload
// so client-side localStorage auto-save doesn't fail.
export async function POST(request: NextRequest) {
  const adminUser = await requireCapability('disputes:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    return NextResponse.json({ success: true, draftId: body?.draftId ?? null });
  } catch {
    return NextResponse.json({ error: 'Invalid draft payload' }, { status: 400 });
  }
}

export async function DELETE() {
  const adminUser = await requireCapability('disputes:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // No-op delete: localStorage is the source of truth for now.
  return NextResponse.json({ success: true });
}


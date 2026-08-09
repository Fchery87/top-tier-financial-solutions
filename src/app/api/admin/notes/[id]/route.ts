import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clientNotes } from '@/db/schema';
import { requireCapability } from '@/lib/admin-session';
import { eq } from 'drizzle-orm';
import { logServerEvent } from '@/lib/server-logger';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireCapability('clients:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    await db.delete(clientNotes).where(eq(clientNotes.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.admin.notes.id.error', error: error });
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}

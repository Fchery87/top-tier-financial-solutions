import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { disclaimers } from '@/db/schema';
import { requireCapability } from '@/lib/admin-session';
import { eq } from 'drizzle-orm';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireCapability('content:write');
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.content !== undefined) updateData.content = body.content;
    if (body.display_hint !== undefined) updateData.displayHint = body.display_hint;
    if (body.is_active !== undefined) updateData.isActive = body.is_active;

    await db.update(disclaimers).set(updateData).where(eq(disclaimers.id, id));

    const [updated] = await db.select().from(disclaimers).where(eq(disclaimers.id, id));

    if (!updated) {
      return NextResponse.json({ error: 'Disclaimer not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      content: updated.content,
      display_hint: updated.displayHint,
      is_active: updated.isActive,
      created_at: updated.createdAt?.toISOString(),
      updated_at: updated.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error('Error updating disclaimer:', error);
    return NextResponse.json({ error: 'Failed to update disclaimer' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireCapability('content:write');
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;

  try {
    const [existing] = await db.select().from(disclaimers).where(eq(disclaimers.id, id));
    
    if (!existing) {
      return NextResponse.json({ error: 'Disclaimer not found' }, { status: 404 });
    }

    await db.delete(disclaimers).where(eq(disclaimers.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting disclaimer:', error);
    return NextResponse.json({ error: 'Failed to delete disclaimer' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { faqItems } from '@/db/schema';
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

    if (body.question !== undefined) updateData.question = body.question;
    if (body.answer !== undefined) updateData.answer = body.answer;
    if (body.display_order !== undefined) updateData.displayOrder = body.display_order;
    if (body.is_published !== undefined) updateData.isPublished = body.is_published;

    await db.update(faqItems).set(updateData).where(eq(faqItems.id, id));

    const [updated] = await db.select().from(faqItems).where(eq(faqItems.id, id));

    if (!updated) {
      return NextResponse.json({ error: 'FAQ not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: updated.id,
      question: updated.question,
      answer: updated.answer,
      display_order: updated.displayOrder,
      is_published: updated.isPublished,
      created_at: updated.createdAt?.toISOString(),
      updated_at: updated.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error('Error updating FAQ:', error);
    return NextResponse.json({ error: 'Failed to update FAQ' }, { status: 500 });
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
    const [existing] = await db.select().from(faqItems).where(eq(faqItems.id, id));
    
    if (!existing) {
      return NextResponse.json({ error: 'FAQ not found' }, { status: 404 });
    }

    await db.delete(faqItems).where(eq(faqItems.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting FAQ:', error);
    return NextResponse.json({ error: 'Failed to delete FAQ' }, { status: 500 });
  }
}

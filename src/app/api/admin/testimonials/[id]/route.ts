import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { testimonials } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { eq } from 'drizzle-orm';

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await validateAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (body.author_name !== undefined) updateData.authorName = body.author_name;
    if (body.author_location !== undefined) updateData.authorLocation = body.author_location;
    if (body.quote !== undefined) updateData.quote = body.quote;
    if (body.order_index !== undefined) updateData.orderIndex = body.order_index;
    if (body.is_approved !== undefined) updateData.isApproved = body.is_approved;

    await db.update(testimonials).set(updateData).where(eq(testimonials.id, id));

    const [updated] = await db.select().from(testimonials).where(eq(testimonials.id, id));

    if (!updated) {
      return NextResponse.json({ error: 'Testimonial not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: updated.id,
      author_name: updated.authorName,
      author_location: updated.authorLocation,
      quote: updated.quote,
      order_index: updated.orderIndex,
      is_approved: updated.isApproved,
      created_at: updated.createdAt?.toISOString(),
      updated_at: updated.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error('Error updating testimonial:', error);
    return NextResponse.json({ error: 'Failed to update testimonial' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await validateAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [existing] = await db.select().from(testimonials).where(eq(testimonials.id, id));
    
    if (!existing) {
      return NextResponse.json({ error: 'Testimonial not found' }, { status: 404 });
    }

    await db.delete(testimonials).where(eq(testimonials.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    return NextResponse.json({ error: 'Failed to delete testimonial' }, { status: 500 });
  }
}

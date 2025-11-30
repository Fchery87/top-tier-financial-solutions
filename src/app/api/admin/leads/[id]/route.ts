import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { consultationRequests } from '@/db/schema';
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await validateAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [lead] = await db.select().from(consultationRequests).where(eq(consultationRequests.id, id));

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: lead.id,
      first_name: lead.firstName,
      last_name: lead.lastName,
      email: lead.email,
      phone_number: lead.phoneNumber,
      message: lead.message,
      source_page_slug: lead.sourcePageSlug,
      status: lead.status,
      requested_at: lead.requestedAt?.toISOString(),
      updated_at: lead.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching lead:', error);
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 });
  }
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

    if (body.status !== undefined) updateData.status = body.status;

    await db.update(consultationRequests).set(updateData).where(eq(consultationRequests.id, id));

    const [updated] = await db.select().from(consultationRequests).where(eq(consultationRequests.id, id));

    if (!updated) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: updated.id,
      first_name: updated.firstName,
      last_name: updated.lastName,
      email: updated.email,
      phone_number: updated.phoneNumber,
      message: updated.message,
      source_page_slug: updated.sourcePageSlug,
      status: updated.status,
      requested_at: updated.requestedAt?.toISOString(),
      updated_at: updated.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
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
    const [existing] = await db.select().from(consultationRequests).where(eq(consultationRequests.id, id));
    
    if (!existing) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    await db.delete(consultationRequests).where(eq(consultationRequests.id, id));

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting lead:', error);
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { services } from '@/db/schema';
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
    const [service] = await db.select().from(services).where(eq(services.id, id));

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: service.id,
      name: service.name,
      description: service.description,
      order_index: service.orderIndex,
      created_at: service.createdAt?.toISOString(),
      updated_at: service.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching service:', error);
    return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 });
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
    const now = new Date();

    const updateData: Record<string, unknown> = { updatedAt: now };
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.order_index !== undefined) updateData.orderIndex = body.order_index;

    await db.update(services).set(updateData).where(eq(services.id, id));

    const [updated] = await db.select().from(services).where(eq(services.id, id));

    if (!updated) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      order_index: updated.orderIndex,
      created_at: updated.createdAt?.toISOString(),
      updated_at: updated.updatedAt?.toISOString(),
    });
  } catch (error) {
    console.error('Error updating service:', error);
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 });
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
    const [service] = await db.select().from(services).where(eq(services.id, id));

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    await db.delete(services).where(eq(services.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting service:', error);
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 });
  }
}

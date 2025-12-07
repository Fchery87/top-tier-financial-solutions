import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { tasks, clients, user } from '@/db/schema';
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
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await db
      .select({
        id: tasks.id,
        clientId: tasks.clientId,
        assigneeId: tasks.assigneeId,
        createdById: tasks.createdById,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        dueDate: tasks.dueDate,
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
        visibleToClient: tasks.visibleToClient,
        isBlocking: tasks.isBlocking,
        clientFirstName: clients.firstName,
        clientLastName: clients.lastName,
        assigneeName: user.name,
      })
      .from(tasks)
      .leftJoin(clients, eq(tasks.clientId, clients.id))
      .leftJoin(user, eq(tasks.assigneeId, user.id))
      .where(eq(tasks.id, id))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const t = result[0];
    return NextResponse.json({
      id: t.id,
      client_id: t.clientId,
      assignee_id: t.assigneeId,
      created_by_id: t.createdById,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      due_date: t.dueDate?.toISOString() || null,
      completed_at: t.completedAt?.toISOString() || null,
      created_at: t.createdAt?.toISOString(),
      updated_at: t.updatedAt?.toISOString(),
      visible_to_client: t.visibleToClient,
      is_blocking: t.isBlocking,
      client_name: t.clientFirstName && t.clientLastName 
        ? `${t.clientFirstName} ${t.clientLastName}` 
        : null,
      assignee_name: t.assigneeName,
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { title, description, client_id, assignee_id, status, priority, due_date, visible_to_client, is_blocking } = body;

    const now = new Date();
    const updateData: Record<string, unknown> = { updatedAt: now };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (client_id !== undefined) updateData.clientId = client_id || null;
    if (assignee_id !== undefined) updateData.assigneeId = assignee_id || null;
    if (status !== undefined) {
      updateData.status = status;
      if (status === 'done') {
        updateData.completedAt = now;
      } else {
        updateData.completedAt = null;
      }
    }
    if (priority !== undefined) updateData.priority = priority;
    if (due_date !== undefined) updateData.dueDate = due_date ? new Date(due_date) : null;
    if (visible_to_client !== undefined) updateData.visibleToClient = visible_to_client;
    if (is_blocking !== undefined) updateData.isBlocking = is_blocking;

    await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id));

    return NextResponse.json({ success: true, updated_at: now.toISOString() });
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await db.delete(tasks).where(eq(tasks.id, id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}

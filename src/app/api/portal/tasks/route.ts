import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { tasks, clients } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { eq, and, or, asc } from 'drizzle-orm';

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return null;
  }

  return session.user;
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, user.id))
      .limit(1);

    if (!client) {
      return NextResponse.json({ tasks: [] });
    }

    const clientTasks = await db
      .select()
      .from(tasks)
      .where(and(
        eq(tasks.clientId, client.id),
        eq(tasks.visibleToClient, true),
        or(
          eq(tasks.status, 'todo'),
          eq(tasks.status, 'in_progress'),
          eq(tasks.status, 'review'),
        ),
      ))
      .orderBy(asc(tasks.dueDate), asc(tasks.createdAt));

    return NextResponse.json({
      tasks: clientTasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        due_date: t.dueDate?.toISOString() || null,
        is_blocking: t.isBlocking,
        created_at: t.createdAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error('Error fetching portal tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

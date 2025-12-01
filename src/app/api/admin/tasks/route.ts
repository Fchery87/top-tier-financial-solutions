import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { tasks, clients, user } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { desc, asc, count, eq, or, ilike, and, gte, lte, isNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';

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

export async function GET(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const clientId = searchParams.get('client_id');
  const assigneeId = searchParams.get('assignee_id');
  const search = searchParams.get('search') || '';
  const sortBy = searchParams.get('sort_by') || 'created_at';
  const sortOrder = searchParams.get('sort_order') || 'desc';
  const dueBefore = searchParams.get('due_before');
  const dueAfter = searchParams.get('due_after');
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          ilike(tasks.title, `%${search}%`),
          ilike(tasks.description, `%${search}%`)
        )
      );
    }
    
    if (status && status !== 'all') {
      conditions.push(eq(tasks.status, status as 'todo' | 'in_progress' | 'review' | 'done'));
    }
    
    if (priority && priority !== 'all') {
      conditions.push(eq(tasks.priority, priority as 'low' | 'medium' | 'high' | 'urgent'));
    }
    
    if (clientId) {
      conditions.push(eq(tasks.clientId, clientId));
    }
    
    if (assigneeId) {
      if (assigneeId === 'unassigned') {
        conditions.push(isNull(tasks.assigneeId));
      } else {
        conditions.push(eq(tasks.assigneeId, assigneeId));
      }
    }

    if (dueBefore) {
      conditions.push(lte(tasks.dueDate, new Date(dueBefore)));
    }

    if (dueAfter) {
      conditions.push(gte(tasks.dueDate, new Date(dueAfter)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Determine sort column
    const sortColumn = sortBy === 'due_date' ? tasks.dueDate 
      : sortBy === 'priority' ? tasks.priority
      : sortBy === 'status' ? tasks.status
      : sortBy === 'title' ? tasks.title
      : tasks.createdAt;
    
    const orderDirection = sortOrder === 'asc' ? asc : desc;

    const [items, totalResult] = await Promise.all([
      db
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
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          assigneeName: user.name,
        })
        .from(tasks)
        .leftJoin(clients, eq(tasks.clientId, clients.id))
        .leftJoin(user, eq(tasks.assigneeId, user.id))
        .where(whereClause)
        .orderBy(orderDirection(sortColumn))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(tasks).where(whereClause),
    ]);

    return NextResponse.json({
      items: items.map((t) => ({
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
        client_name: t.clientFirstName && t.clientLastName 
          ? `${t.clientFirstName} ${t.clientLastName}` 
          : null,
        assignee_name: t.assigneeName,
      })),
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { 
      title, 
      description, 
      client_id, 
      assignee_id, 
      status = 'todo', 
      priority = 'medium', 
      due_date 
    } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const id = randomUUID();
    const now = new Date();

    await db.insert(tasks).values({
      id,
      clientId: client_id || null,
      assigneeId: assignee_id || null,
      createdById: adminUser.id,
      title,
      description: description || null,
      status: status as 'todo' | 'in_progress' | 'review' | 'done',
      priority: priority as 'low' | 'medium' | 'high' | 'urgent',
      dueDate: due_date ? new Date(due_date) : null,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      id,
      title,
      description,
      client_id,
      assignee_id,
      status,
      priority,
      due_date,
      created_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

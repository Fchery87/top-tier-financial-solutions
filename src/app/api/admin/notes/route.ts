import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clientNotes, clients, user } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { desc, count, eq, and } from 'drizzle-orm';
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
  const clientId = searchParams.get('client_id');
  const offset = (page - 1) * limit;

  // SECURITY: client_id is required to prevent cross-client data exposure
  if (!clientId) {
    return NextResponse.json(
      { error: 'client_id is required' },
      { status: 400 }
    );
  }

  try {
    const whereClause = eq(clientNotes.clientId, clientId);

    const [items, totalResult] = await Promise.all([
      db
        .select({
          id: clientNotes.id,
          clientId: clientNotes.clientId,
          authorId: clientNotes.authorId,
          content: clientNotes.content,
          createdAt: clientNotes.createdAt,
          updatedAt: clientNotes.updatedAt,
          clientFirstName: clients.firstName,
          clientLastName: clients.lastName,
          authorName: user.name,
        })
        .from(clientNotes)
        .leftJoin(clients, eq(clientNotes.clientId, clients.id))
        .leftJoin(user, eq(clientNotes.authorId, user.id))
        .where(whereClause)
        .orderBy(desc(clientNotes.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(clientNotes).where(whereClause),
    ]);

    return NextResponse.json({
      items: items.map((n) => ({
        id: n.id,
        client_id: n.clientId,
        author_id: n.authorId,
        content: n.content,
        created_at: n.createdAt?.toISOString(),
        updated_at: n.updatedAt?.toISOString(),
        client_name: n.clientFirstName && n.clientLastName 
          ? `${n.clientFirstName} ${n.clientLastName}` 
          : null,
        author_name: n.authorName,
      })),
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { client_id, content } = body;

    if (!client_id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Verify client exists
    const clientExists = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, client_id))
      .limit(1);

    if (clientExists.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const id = randomUUID();
    const now = new Date();

    await db.insert(clientNotes).values({
      id,
      clientId: client_id,
      authorId: adminUser.id,
      content: content.trim(),
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      id,
      client_id,
      author_id: adminUser.id,
      author_name: adminUser.name,
      content: content.trim(),
      created_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}

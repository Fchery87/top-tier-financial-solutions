import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, consultationRequests, user, creditReports, creditAnalyses } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { desc, asc, count, eq, or, ilike, and } from 'drizzle-orm';
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
  const limit = parseInt(searchParams.get('limit') || '10');
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status');
  const sortBy = searchParams.get('sort_by') || 'created_at';
  const sortOrder = searchParams.get('sort_order') || 'desc';
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    
    if (search) {
      conditions.push(
        or(
          ilike(clients.firstName, `%${search}%`),
          ilike(clients.lastName, `%${search}%`),
          ilike(clients.email, `%${search}%`),
          ilike(clients.phone, `%${search}%`)
        )
      );
    }
    
    if (status && status !== 'all') {
      conditions.push(eq(clients.status, status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Determine sort column
    const sortColumn = sortBy === 'name' ? clients.firstName 
      : sortBy === 'email' ? clients.email
      : sortBy === 'status' ? clients.status
      : sortBy === 'converted_at' ? clients.convertedAt
      : clients.createdAt;
    
    const orderDirection = sortOrder === 'asc' ? asc : desc;

    const [items, totalResult] = await Promise.all([
      db
        .select({
          id: clients.id,
          userId: clients.userId,
          leadId: clients.leadId,
          firstName: clients.firstName,
          lastName: clients.lastName,
          email: clients.email,
          phone: clients.phone,
          status: clients.status,
          notes: clients.notes,
          convertedAt: clients.convertedAt,
          createdAt: clients.createdAt,
          updatedAt: clients.updatedAt,
          userName: user.name,
        })
        .from(clients)
        .leftJoin(user, eq(clients.userId, user.id))
        .where(whereClause)
        .orderBy(orderDirection(sortColumn))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(clients).where(whereClause),
    ]);

    return NextResponse.json({
      items: items.map((c) => ({
        id: c.id,
        user_id: c.userId,
        lead_id: c.leadId,
        first_name: c.firstName,
        last_name: c.lastName,
        email: c.email,
        phone: c.phone,
        status: c.status,
        notes: c.notes,
        converted_at: c.convertedAt?.toISOString(),
        created_at: c.createdAt?.toISOString(),
        updated_at: c.updatedAt?.toISOString(),
        user_name: c.userName,
      })),
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { first_name, last_name, email, phone, notes, lead_id, user_id } = body;

    if (!first_name || !last_name || !email) {
      return NextResponse.json({ error: 'First name, last name, and email are required' }, { status: 400 });
    }

    const id = randomUUID();
    const now = new Date();

    await db.insert(clients).values({
      id,
      userId: user_id || null,
      leadId: lead_id || null,
      firstName: first_name,
      lastName: last_name,
      email,
      phone: phone || null,
      status: 'active',
      notes: notes || null,
      convertedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // If converting from a lead, update the lead status
    if (lead_id) {
      await db
        .update(consultationRequests)
        .set({ status: 'archived', updatedAt: now }) // Mark as archived when converted to client
        .where(eq(consultationRequests.id, lead_id));
    }

    return NextResponse.json({
      id,
      first_name,
      last_name,
      email,
      phone,
      status: 'active',
      notes,
      lead_id,
      user_id,
      converted_at: now.toISOString(),
      created_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}

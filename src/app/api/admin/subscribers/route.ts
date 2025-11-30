import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { emailSubscribers } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { desc, count, eq } from 'drizzle-orm';
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
  const offset = (page - 1) * limit;

  try {
    let query = db.select().from(emailSubscribers);
    
    if (status) {
      query = query.where(eq(emailSubscribers.status, status)) as typeof query;
    }
    
    const [items, totalResult, activeCount, unsubscribedCount] = await Promise.all([
      query.orderBy(desc(emailSubscribers.createdAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(emailSubscribers),
      db.select({ count: count() }).from(emailSubscribers).where(eq(emailSubscribers.status, 'active')),
      db.select({ count: count() }).from(emailSubscribers).where(eq(emailSubscribers.status, 'unsubscribed')),
    ]);

    return NextResponse.json({
      items: items.map((s) => ({
        id: s.id,
        email: s.email,
        first_name: s.firstName,
        last_name: s.lastName,
        source: s.source,
        status: s.status,
        subscribed_at: s.subscribedAt?.toISOString(),
        unsubscribed_at: s.unsubscribedAt?.toISOString(),
        created_at: s.createdAt?.toISOString(),
      })),
      stats: {
        total: totalResult[0].count,
        active: activeCount[0].count,
        unsubscribed: unsubscribedCount[0].count,
      },
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    return NextResponse.json({ error: 'Failed to fetch subscribers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = randomUUID();
    const now = new Date();

    await db.insert(emailSubscribers).values({
      id,
      email: body.email.toLowerCase(),
      firstName: body.first_name,
      lastName: body.last_name,
      source: 'manual',
      status: 'active',
      subscribedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      id,
      email: body.email.toLowerCase(),
      created_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding subscriber:', error);
    return NextResponse.json({ error: 'Failed to add subscriber' }, { status: 500 });
  }
}

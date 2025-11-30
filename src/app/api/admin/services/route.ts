import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { services } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { desc, count } from 'drizzle-orm';
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
  const user = await validateAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  try {
    const [items, totalResult] = await Promise.all([
      db.select().from(services).orderBy(desc(services.orderIndex)).limit(limit).offset(offset),
      db.select({ count: count() }).from(services),
    ]);

    return NextResponse.json({
      items: items.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        order_index: s.orderIndex,
        created_at: s.createdAt?.toISOString(),
        updated_at: s.updatedAt?.toISOString(),
      })),
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await validateAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = randomUUID();
    const now = new Date();

    await db.insert(services).values({
      id,
      name: body.name,
      description: body.description,
      orderIndex: body.order_index || 0,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      id,
      name: body.name,
      description: body.description,
      order_index: body.order_index || 0,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating service:', error);
    return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
  }
}

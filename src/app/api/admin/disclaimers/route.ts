import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { disclaimers } from '@/db/schema';
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
      db.select().from(disclaimers).orderBy(desc(disclaimers.createdAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(disclaimers),
    ]);

    return NextResponse.json({
      items: items.map(d => ({
        id: d.id,
        name: d.name,
        content: d.content,
        display_hint: d.displayHint,
        is_active: d.isActive,
        created_at: d.createdAt?.toISOString(),
        updated_at: d.updatedAt?.toISOString(),
      })),
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching disclaimers:', error);
    return NextResponse.json({ error: 'Failed to fetch disclaimers' }, { status: 500 });
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

    await db.insert(disclaimers).values({
      id,
      name: body.name,
      content: body.content,
      displayHint: body.display_hint,
      isActive: body.is_active ?? true,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      id,
      name: body.name,
      content: body.content,
      display_hint: body.display_hint,
      is_active: body.is_active ?? true,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating disclaimer:', error);
    return NextResponse.json({ error: 'Failed to create disclaimer' }, { status: 500 });
  }
}

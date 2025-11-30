import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { blogCategories } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { asc, count } from 'drizzle-orm';
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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export async function GET(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const items = await db.select().from(blogCategories).orderBy(asc(blogCategories.orderIndex));

    return NextResponse.json({
      items: items.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        order_index: c.orderIndex,
        created_at: c.createdAt?.toISOString(),
        updated_at: c.updatedAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching blog categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
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
    const slug = body.slug || slugify(body.name);

    await db.insert(blogCategories).values({
      id,
      name: body.name,
      slug,
      description: body.description,
      orderIndex: body.order_index ?? 0,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      id,
      name: body.name,
      slug,
      created_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating blog category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}

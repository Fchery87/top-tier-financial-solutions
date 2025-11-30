import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { faqItems } from '@/db/schema';
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
      db.select().from(faqItems).orderBy(desc(faqItems.displayOrder)).limit(limit).offset(offset),
      db.select({ count: count() }).from(faqItems),
    ]);

    return NextResponse.json({
      items: items.map(f => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        display_order: f.displayOrder,
        is_published: f.isPublished,
        created_at: f.createdAt?.toISOString(),
        updated_at: f.updatedAt?.toISOString(),
      })),
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching FAQs:', error);
    return NextResponse.json({ error: 'Failed to fetch FAQs' }, { status: 500 });
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

    await db.insert(faqItems).values({
      id,
      question: body.question,
      answer: body.answer,
      displayOrder: body.display_order || 0,
      isPublished: body.is_published ?? true,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      id,
      question: body.question,
      answer: body.answer,
      display_order: body.display_order || 0,
      is_published: body.is_published ?? true,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating FAQ:', error);
    return NextResponse.json({ error: 'Failed to create FAQ' }, { status: 500 });
  }
}

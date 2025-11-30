import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { testimonials } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { eq, desc, count } from 'drizzle-orm';
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
      db.select().from(testimonials).orderBy(desc(testimonials.createdAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(testimonials),
    ]);

    return NextResponse.json({
      items: items.map(t => ({
        id: t.id,
        author_name: t.authorName,
        author_location: t.authorLocation,
        quote: t.quote,
        order_index: t.orderIndex,
        is_approved: t.isApproved,
        created_at: t.createdAt?.toISOString(),
        updated_at: t.updatedAt?.toISOString(),
      })),
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    return NextResponse.json({ error: 'Failed to fetch testimonials' }, { status: 500 });
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

    await db.insert(testimonials).values({
      id,
      authorName: body.author_name,
      authorLocation: body.author_location,
      quote: body.quote,
      orderIndex: body.order_index || 0,
      isApproved: body.is_approved || false,
      createdAt: now,
      updatedAt: now,
    });

    const [newTestimonial] = await db.select().from(testimonials).where(eq(testimonials.id, id));

    return NextResponse.json({
      id: newTestimonial.id,
      author_name: newTestimonial.authorName,
      author_location: newTestimonial.authorLocation,
      quote: newTestimonial.quote,
      order_index: newTestimonial.orderIndex,
      is_approved: newTestimonial.isApproved,
      created_at: newTestimonial.createdAt?.toISOString(),
      updated_at: newTestimonial.updatedAt?.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating testimonial:', error);
    return NextResponse.json({ error: 'Failed to create testimonial' }, { status: 500 });
  }
}

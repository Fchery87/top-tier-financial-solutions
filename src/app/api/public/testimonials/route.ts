import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { testimonials } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';

export async function GET() {
  try {
    const items = await db
      .select()
      .from(testimonials)
      .where(eq(testimonials.isApproved, true))
      .orderBy(asc(testimonials.orderIndex));

    return NextResponse.json(
      items.map((t) => ({
        id: t.id,
        author_name: t.authorName,
        author_location: t.authorLocation,
        quote: t.quote,
        created_at: t.createdAt?.toISOString(),
        updated_at: t.updatedAt?.toISOString(),
      }))
    );
  } catch (error) {
    console.error('Error fetching public testimonials:', error);
    return NextResponse.json({ error: 'Failed to fetch testimonials' }, { status: 500 });
  }
}

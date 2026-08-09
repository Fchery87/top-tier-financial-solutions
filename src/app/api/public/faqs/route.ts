import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { faqItems } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { logServerEvent } from '@/lib/server-logger';

export async function GET() {
  try {
    const items = await db
      .select()
      .from(faqItems)
      .where(eq(faqItems.isPublished, true))
      .orderBy(asc(faqItems.displayOrder));

    return NextResponse.json(
      items.map((f) => ({
        id: f.id,
        question: f.question,
        answer: f.answer,
        display_order: f.displayOrder,
        is_published: f.isPublished,
        created_at: f.createdAt?.toISOString(),
        updated_at: f.updatedAt?.toISOString(),
      }))
    );
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.public.faqs.error', error: error });
    return NextResponse.json({ error: 'Failed to fetch FAQs' }, { status: 500 });
  }
}

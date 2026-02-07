import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { disclaimers } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';

export async function GET() {
  try {
    const items = await db
      .select()
      .from(disclaimers)
      .where(eq(disclaimers.isActive, true))
      .orderBy(asc(disclaimers.createdAt));

    return NextResponse.json(
      items.map((d) => ({
        id: d.id,
        name: d.name,
        content: d.content,
        display_hint: d.displayHint,
        created_at: d.createdAt?.toISOString(),
        updated_at: d.updatedAt?.toISOString(),
      }))
    );
  } catch (error) {
    console.error('Error fetching public disclaimers:', error);
    return NextResponse.json({ error: 'Failed to fetch disclaimers' }, { status: 500 });
  }
}

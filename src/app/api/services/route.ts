import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { services } from '@/db/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
  try {
    const items = await db.select().from(services).orderBy(asc(services.orderIndex));

    return NextResponse.json({
      services: items.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        order_index: s.orderIndex,
      })),
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    return NextResponse.json({ error: 'Failed to fetch services', services: [] }, { status: 500 });
  }
}

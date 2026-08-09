import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { services } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { logServerEvent } from '@/lib/server-logger';

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
    logServerEvent({ level: 'error', event: 'server.app.api.services.error', error: error });
    return NextResponse.json({ error: 'Failed to fetch services', services: [] }, { status: 500 });
  }
}

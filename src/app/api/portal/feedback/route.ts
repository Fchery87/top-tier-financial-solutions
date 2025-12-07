import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, clientFeedback } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return null;
  }

  return session.user;
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const context = request.nextUrl.searchParams.get('context') || undefined;

  try {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, user.id))
      .limit(1);

    if (!client) {
      return NextResponse.json({ feedback: [] });
    }

    const baseWhere = eq(clientFeedback.clientId, client.id);
    const whereClause = context
      ? and(baseWhere, eq(clientFeedback.context, context))
      : baseWhere;

    const rows = await db
      .select()
      .from(clientFeedback)
      .where(whereClause)
      .orderBy(desc(clientFeedback.createdAt));

    return NextResponse.json({
      feedback: rows.map((f) => ({
        id: f.id,
        context: f.context,
        rating: f.rating,
        comment: f.comment,
        created_at: f.createdAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error('Error fetching portal feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const context = (body.context as string | undefined) || 'portal_overall';
    const ratingValue = body.rating as number | undefined;
    const comment = (body.comment as string | undefined) || null;

    if (typeof ratingValue !== 'number' || Number.isNaN(ratingValue)) {
      return NextResponse.json({ error: 'Rating is required' }, { status: 400 });
    }

    const rating = Math.round(ratingValue);
    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, user.id))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client profile not found' }, { status: 404 });
    }

    const now = new Date();
    const id = randomUUID();

    await db.insert(clientFeedback).values({
      id,
      clientId: client.id,
      context,
      rating,
      comment,
      createdAt: now,
    });

    return NextResponse.json({
      id,
      context,
      rating,
      comment,
      created_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error submitting portal feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clientCases, caseUpdates, user } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { desc, count, eq } from 'drizzle-orm';
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
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  try {
    const [items, totalResult] = await Promise.all([
      db
        .select({
          id: clientCases.id,
          caseNumber: clientCases.caseNumber,
          status: clientCases.status,
          currentPhase: clientCases.currentPhase,
          creditScoreStart: clientCases.creditScoreStart,
          creditScoreCurrent: clientCases.creditScoreCurrent,
          negativeItemsStart: clientCases.negativeItemsStart,
          negativeItemsRemoved: clientCases.negativeItemsRemoved,
          startedAt: clientCases.startedAt,
          completedAt: clientCases.completedAt,
          createdAt: clientCases.createdAt,
          userId: clientCases.userId,
          userName: user.name,
          userEmail: user.email,
        })
        .from(clientCases)
        .leftJoin(user, eq(clientCases.userId, user.id))
        .orderBy(desc(clientCases.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(clientCases),
    ]);

    return NextResponse.json({
      items: items.map((c) => ({
        id: c.id,
        case_number: c.caseNumber,
        status: c.status,
        current_phase: c.currentPhase,
        credit_score_start: c.creditScoreStart,
        credit_score_current: c.creditScoreCurrent,
        negative_items_start: c.negativeItemsStart,
        negative_items_removed: c.negativeItemsRemoved,
        started_at: c.startedAt?.toISOString(),
        completed_at: c.completedAt?.toISOString(),
        created_at: c.createdAt?.toISOString(),
        user_id: c.userId,
        user_name: c.userName,
        user_email: c.userEmail,
      })),
      total: totalResult[0].count,
      page,
      limit,
    });
  } catch (error) {
    console.error('Error fetching cases:', error);
    return NextResponse.json({ error: 'Failed to fetch cases' }, { status: 500 });
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
    const caseNumber = `TT-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date();

    await db.insert(clientCases).values({
      id,
      userId: body.user_id,
      caseNumber,
      status: body.status || 'pending',
      currentPhase: body.current_phase || 'initial_review',
      creditScoreStart: body.credit_score_start,
      creditScoreCurrent: body.credit_score_current,
      negativeItemsStart: body.negative_items_start,
      negativeItemsRemoved: body.negative_items_removed || 0,
      notes: body.notes,
      startedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    // Create initial update
    await db.insert(caseUpdates).values({
      id: randomUUID(),
      caseId: id,
      title: 'Case Created',
      description: 'Your credit repair case has been opened. We will begin reviewing your credit reports.',
      updateType: 'milestone',
      isVisibleToClient: true,
      createdAt: now,
    });

    return NextResponse.json({
      id,
      case_number: caseNumber,
      status: body.status || 'pending',
      current_phase: body.current_phase || 'initial_review',
      created_at: now.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating case:', error);
    return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
  }
}

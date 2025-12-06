import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clientCases, caseUpdates } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { eq, desc } from 'drizzle-orm';

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.id) {
    return null;
  }
  
  return session.user;
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cases = await db
      .select()
      .from(clientCases)
      .where(eq(clientCases.userId, user.id))
      .orderBy(desc(clientCases.createdAt));

    const casesWithUpdates = await Promise.all(
      cases.map(async (c) => {
        const updates = await db
          .select()
          .from(caseUpdates)
          .where(eq(caseUpdates.caseId, c.id))
          .orderBy(desc(caseUpdates.createdAt))
          .limit(5);

        return {
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
          updates: updates
            .filter((u) => u.isVisibleToClient)
            .map((u) => ({
              id: u.id,
              title: u.title,
              description: u.description,
              update_type: u.updateType,
              created_at: u.createdAt?.toISOString(),
            })),
        };
      })
    );

    return NextResponse.json({ cases: casesWithUpdates });
  } catch (error) {
    console.error('Error fetching cases:', error);
    return NextResponse.json({ error: 'Failed to fetch cases' }, { status: 500 });
  }
}

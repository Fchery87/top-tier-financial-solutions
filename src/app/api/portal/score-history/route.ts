import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { creditScoreHistory, clients } from '@/db/schema';
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
    // Find the client record for this user
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, user.id))
      .limit(1);

    if (!client) {
      return NextResponse.json({ 
        history: [],
        summary: null,
      });
    }

    // Fetch score history
    const history = await db
      .select()
      .from(creditScoreHistory)
      .where(eq(creditScoreHistory.clientId, client.id))
      .orderBy(desc(creditScoreHistory.recordedAt))
      .limit(12);

    // Calculate summary
    let summary = null;
    if (history.length > 0) {
      const latest = history[0];
      const oldest = history[history.length - 1];
      
      summary = {
        current_average: latest.averageScore,
        starting_average: oldest.averageScore,
        total_change: (latest.averageScore || 0) - (oldest.averageScore || 0),
        current_scores: {
          transunion: latest.scoreTransunion,
          experian: latest.scoreExperian,
          equifax: latest.scoreEquifax,
        },
        records_count: history.length,
      };
    }

    return NextResponse.json({ 
      history: history.map(h => ({
        id: h.id,
        score_transunion: h.scoreTransunion,
        score_experian: h.scoreExperian,
        score_equifax: h.scoreEquifax,
        average_score: h.averageScore,
        recorded_at: h.recordedAt?.toISOString(),
      })),
      summary,
    });
  } catch (error) {
    console.error('Error fetching score history:', error);
    return NextResponse.json({ error: 'Failed to fetch score history' }, { status: 500 });
  }
}

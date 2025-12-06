import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { creditScoreHistory, clients } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isAdmin } from '@/lib/admin-auth';
import { gte } from 'drizzle-orm';

interface TrendPoint {
  date: string;
  avgScore: number;
  clientCount: number;
}

interface TopImprover {
  clientId: string;
  clientName: string;
  startScore: number;
  currentScore: number;
  improvement: number;
}

async function validateAdminAccess() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user?.email) {
    return false;
  }
  
  return await isAdmin(session.user.email);
}

export async function GET() {
  const authorized = await validateAdminAccess();
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get score history for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const scoreHistory = await db
      .select({
        clientId: creditScoreHistory.clientId,
        recordedAt: creditScoreHistory.recordedAt,
        scoreTransunion: creditScoreHistory.scoreTransunion,
        scoreExperian: creditScoreHistory.scoreExperian,
        scoreEquifax: creditScoreHistory.scoreEquifax,
        averageScore: creditScoreHistory.averageScore,
      })
      .from(creditScoreHistory)
      .where(gte(creditScoreHistory.recordedAt, sixMonthsAgo))
      .orderBy(creditScoreHistory.recordedAt);

    // Group by month for trend data
    const monthlyData = new Map<string, { total: number; count: number }>();
    
    for (const record of scoreHistory) {
      if (!record.recordedAt) continue;
      
      const monthKey = record.recordedAt.toISOString().slice(0, 7); // YYYY-MM
      const avgScore = record.averageScore || 
        Math.round(
          ((record.scoreTransunion || 0) + (record.scoreExperian || 0) + (record.scoreEquifax || 0)) /
          ((record.scoreTransunion ? 1 : 0) + (record.scoreExperian ? 1 : 0) + (record.scoreEquifax ? 1 : 0) || 1)
        );

      if (avgScore > 0) {
        const existing = monthlyData.get(monthKey) || { total: 0, count: 0 };
        monthlyData.set(monthKey, {
          total: existing.total + avgScore,
          count: existing.count + 1,
        });
      }
    }

    // Convert to trend points
    const trends: TrendPoint[] = Array.from(monthlyData.entries())
      .map(([date, data]) => ({
        date,
        avgScore: Math.round(data.total / data.count),
        clientCount: data.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Get top improvers (clients with biggest score increase)
    const clientScores = new Map<string, { first: number; last: number; firstDate: Date; lastDate: Date }>();
    
    for (const record of scoreHistory) {
      if (!record.recordedAt) continue;
      
      const avgScore = record.averageScore || 
        Math.round(
          ((record.scoreTransunion || 0) + (record.scoreExperian || 0) + (record.scoreEquifax || 0)) /
          ((record.scoreTransunion ? 1 : 0) + (record.scoreExperian ? 1 : 0) + (record.scoreEquifax ? 1 : 0) || 1)
        );

      if (avgScore > 0) {
        const existing = clientScores.get(record.clientId);
        if (!existing) {
          clientScores.set(record.clientId, {
            first: avgScore,
            last: avgScore,
            firstDate: record.recordedAt,
            lastDate: record.recordedAt,
          });
        } else {
          if (record.recordedAt < existing.firstDate) {
            existing.first = avgScore;
            existing.firstDate = record.recordedAt;
          }
          if (record.recordedAt > existing.lastDate) {
            existing.last = avgScore;
            existing.lastDate = record.recordedAt;
          }
        }
      }
    }

    // Get client names for top improvers
    const clientIds = Array.from(clientScores.keys());
    const clientDetails = clientIds.length > 0 
      ? await db
          .select({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName })
          .from(clients)
      : [];

    const clientNameMap = new Map(
      clientDetails.map(c => [c.id, `${c.firstName} ${c.lastName}`])
    );

    // Calculate improvements and get top 5
    const improvements: TopImprover[] = Array.from(clientScores.entries())
      .map(([clientId, scores]) => ({
        clientId,
        clientName: clientNameMap.get(clientId) || 'Unknown',
        startScore: scores.first,
        currentScore: scores.last,
        improvement: scores.last - scores.first,
      }))
      .filter(i => i.improvement > 0)
      .sort((a, b) => b.improvement - a.improvement)
      .slice(0, 5);

    // Calculate overall stats
    const allScores = Array.from(clientScores.values());
    const overallAvg = allScores.length > 0
      ? Math.round(allScores.reduce((sum, s) => sum + s.last, 0) / allScores.length)
      : 0;
    const totalImprovement = allScores.reduce((sum, s) => sum + Math.max(0, s.last - s.first), 0);

    return NextResponse.json({
      trends,
      topImprovers: improvements,
      stats: {
        averageScore: overallAvg,
        totalImprovement,
        clientsTracked: clientScores.size,
      },
    });
  } catch (error) {
    console.error('Error fetching trend data:', error);
    return NextResponse.json({ error: 'Failed to fetch trend data' }, { status: 500 });
  }
}

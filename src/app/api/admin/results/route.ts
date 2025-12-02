import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { disputes, clients, negativeItems, creditScoreHistory } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

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

  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range') || 'month';

  try {
    // Calculate date range
    const now = new Date();
    let startDate: Date;
    
    switch (range) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(0); // All time
    }

    // Get all deleted disputes with client info
    const deletedDisputes = await db
      .select({
        dispute: disputes,
        client: clients,
        negativeItem: negativeItems,
      })
      .from(disputes)
      .leftJoin(clients, eq(disputes.clientId, clients.id))
      .leftJoin(negativeItems, eq(disputes.negativeItemId, negativeItems.id))
      .where(eq(disputes.outcome, 'deleted'))
      .orderBy(desc(disputes.responseReceivedAt));

    // Filter by date range
    const filteredDisputes = range === 'all' 
      ? deletedDisputes
      : deletedDisputes.filter(d => {
          const deletedAt = d.dispute.responseReceivedAt;
          return deletedAt && deletedAt >= startDate;
        });

    // Calculate total deletions
    const totalDeletions = filteredDisputes.length;

    // Deletions this month and week
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const deletionsThisMonth = deletedDisputes.filter(d => {
      const deletedAt = d.dispute.responseReceivedAt;
      return deletedAt && deletedAt >= oneMonthAgo;
    }).length;

    const deletionsThisWeek = deletedDisputes.filter(d => {
      const deletedAt = d.dispute.responseReceivedAt;
      return deletedAt && deletedAt >= oneWeekAgo;
    }).length;

    // Calculate total amount removed
    const totalAmountRemoved = filteredDisputes.reduce((sum, d) => {
      return sum + (d.negativeItem?.amount || 0);
    }, 0);

    // Group by bureau
    const byBureau = {
      transunion: filteredDisputes.filter(d => d.dispute.bureau === 'transunion').length,
      experian: filteredDisputes.filter(d => d.dispute.bureau === 'experian').length,
      equifax: filteredDisputes.filter(d => d.dispute.bureau === 'equifax').length,
    };

    // Group by item type
    const byItemType: Record<string, number> = {};
    for (const d of filteredDisputes) {
      const itemType = d.negativeItem?.itemType || 'unknown';
      byItemType[itemType] = (byItemType[itemType] || 0) + 1;
    }

    // Get all disputes for success rate calculation
    const allDisputes = await db
      .select()
      .from(disputes)
      .where(
        and(
          gte(disputes.createdAt, range === 'all' ? new Date(0) : startDate)
        )
      );

    const resolvedDisputes = allDisputes.filter(d => d.outcome !== null);
    const successRate = resolvedDisputes.length > 0
      ? Math.round((filteredDisputes.length / resolvedDisputes.length) * 100)
      : 0;

    // Get score history to calculate average improvement
    const clientsWithDeletions = [...new Set(filteredDisputes.map(d => d.dispute.clientId))];
    
    let totalScoreIncrease = 0;
    let clientsWithScoreData = 0;

    for (const clientId of clientsWithDeletions) {
      const scores = await db
        .select()
        .from(creditScoreHistory)
        .where(eq(creditScoreHistory.clientId, clientId))
        .orderBy(creditScoreHistory.recordedAt);

      if (scores.length >= 2) {
        const firstScore = scores[0].averageScore;
        const lastScore = scores[scores.length - 1].averageScore;
        
        if (firstScore && lastScore) {
          totalScoreIncrease += lastScore - firstScore;
          clientsWithScoreData++;
        }
      }
    }

    const averageScoreIncrease = clientsWithScoreData > 0
      ? Math.round(totalScoreIncrease / clientsWithScoreData)
      : 0;

    // Recent wins (top 10)
    const recentWins = filteredDisputes.slice(0, 10).map(d => ({
      id: d.dispute.id,
      client_id: d.dispute.clientId,
      client_name: d.client ? `${d.client.firstName} ${d.client.lastName}` : 'Unknown',
      creditor_name: d.negativeItem?.creditorName || d.dispute.creditorName || 'Unknown',
      item_type: d.negativeItem?.itemType || 'unknown',
      bureau: d.dispute.bureau,
      amount: d.negativeItem?.amount || null,
      deleted_at: d.dispute.responseReceivedAt?.toISOString() || d.dispute.updatedAt?.toISOString() || '',
      dispute_id: d.dispute.id,
      dispute_round: d.dispute.round,
    }));

    // Top performers (clients with most deletions)
    const clientDeletionCounts: Record<string, { 
      client_id: string;
      client_name: string;
      deletions_count: number;
      score_increase: number;
    }> = {};

    for (const d of filteredDisputes) {
      const clientId = d.dispute.clientId;
      if (!clientDeletionCounts[clientId]) {
        clientDeletionCounts[clientId] = {
          client_id: clientId,
          client_name: d.client ? `${d.client.firstName} ${d.client.lastName}` : 'Unknown',
          deletions_count: 0,
          score_increase: 0,
        };
      }
      clientDeletionCounts[clientId].deletions_count++;
    }

    // Add score increases to top performers
    for (const clientId of Object.keys(clientDeletionCounts)) {
      const scores = await db
        .select()
        .from(creditScoreHistory)
        .where(eq(creditScoreHistory.clientId, clientId))
        .orderBy(creditScoreHistory.recordedAt);

      if (scores.length >= 2) {
        const firstScore = scores[0].averageScore;
        const lastScore = scores[scores.length - 1].averageScore;
        
        if (firstScore && lastScore) {
          clientDeletionCounts[clientId].score_increase = lastScore - firstScore;
        }
      }
    }

    const topPerformers = Object.values(clientDeletionCounts)
      .sort((a, b) => b.deletions_count - a.deletions_count)
      .slice(0, 10);

    return NextResponse.json({
      total_deletions: totalDeletions,
      deletions_this_month: deletionsThisMonth,
      deletions_this_week: deletionsThisWeek,
      total_amount_removed: totalAmountRemoved,
      average_score_increase: averageScoreIncrease,
      success_rate: successRate,
      by_bureau: byBureau,
      by_item_type: byItemType,
      recent_wins: recentWins,
      top_performers: topPerformers,
    });
  } catch (error) {
    console.error('Error fetching results:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch results' },
      { status: 500 }
    );
  }
}

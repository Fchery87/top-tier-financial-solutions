import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { disputes } from '@/db/schema';
import { and, gte } from 'drizzle-orm';

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
        startDate = new Date(0);
    }

    const allDisputes = await db
      .select()
      .from(disputes)
      .where(and(gte(disputes.createdAt, startDate)));

    if (allDisputes.length === 0) {
      return NextResponse.json({
        range,
        avg_time_to_deletion_days: null,
        methodology_effectiveness: [],
        bureau_response_patterns: {},
      });
    }

    const dayMs = 24 * 60 * 60 * 1000;

    // Average time-to-deletion
    let deletionDaysSum = 0;
    let deletionCount = 0;

    for (const d of allDisputes) {
      if (d.outcome !== 'deleted') continue;
      const start = d.sentAt || d.createdAt;
      const end = d.responseReceivedAt || d.updatedAt;
      if (!start || !end) continue;
      const diffDays = (end.getTime() - start.getTime()) / dayMs;
      if (diffDays >= 0) {
        deletionDaysSum += diffDays;
        deletionCount++;
      }
    }

    const avgTimeToDeletionDays = deletionCount
      ? Math.round((deletionDaysSum / deletionCount) * 10) / 10
      : null;

    // Methodology effectiveness
    const methodologyMap = new Map<
      string,
      { total: number; deleted: number; roundsSum: number }
    >();

    for (const d of allDisputes) {
      const key = d.methodology || 'standard';
      const entry = methodologyMap.get(key) || {
        total: 0,
        deleted: 0,
        roundsSum: 0,
      };
      entry.total++;
      entry.roundsSum += d.round || 1;
      if (d.outcome === 'deleted') entry.deleted++;
      methodologyMap.set(key, entry);
    }

    const methodologyEffectiveness = Array.from(methodologyMap.entries())
      .map(([methodology, data]) => ({
        methodology,
        total: data.total,
        deleted: data.deleted,
        success_rate:
          data.total > 0
            ? Math.round((data.deleted / data.total) * 100)
            : 0,
        avg_rounds:
          data.total > 0
            ? Math.round((data.roundsSum / data.total) * 10) / 10
            : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Bureau response patterns
    const bureauStats: Record<
      string,
      {
        total: number;
        deleted: number;
        noResponse: number;
        responseDaysSum: number;
        responseCount: number;
      }
    > = {};

    for (const d of allDisputes) {
      const bureau = d.bureau || 'unknown';
      if (!bureauStats[bureau]) {
        bureauStats[bureau] = {
          total: 0,
          deleted: 0,
          noResponse: 0,
          responseDaysSum: 0,
          responseCount: 0,
        };
      }

      const stats = bureauStats[bureau];
      stats.total++;
      if (d.outcome === 'deleted') stats.deleted++;
      if (d.outcome === 'no_response') stats.noResponse++;

      const start = d.sentAt || d.createdAt;
      const end = d.responseReceivedAt;
      if (start && end) {
        const diffDays = (end.getTime() - start.getTime()) / dayMs;
        if (diffDays >= 0) {
          stats.responseDaysSum += diffDays;
          stats.responseCount++;
        }
      }
    }

    const bureauResponsePatterns = Object.entries(bureauStats).reduce(
      (acc, [bureau, s]) => {
        const avgResponseDays = s.responseCount
          ? Math.round((s.responseDaysSum / s.responseCount) * 10) / 10
          : null;
        const deletedRate = s.total
          ? Math.round((s.deleted / s.total) * 100)
          : 0;
        const noResponseRate = s.total
          ? Math.round((s.noResponse / s.total) * 100)
          : 0;

        acc[bureau] = {
          total: s.total,
          avg_response_days: avgResponseDays,
          deleted_rate: deletedRate,
          no_response_rate: noResponseRate,
        };
        return acc;
      },
      {} as Record<
        string,
        {
          total: number;
          avg_response_days: number | null;
          deleted_rate: number;
          no_response_rate: number;
        }
      >
    );

    return NextResponse.json({
      range,
      avg_time_to_deletion_days: avgTimeToDeletionDays,
      methodology_effectiveness: methodologyEffectiveness,
      bureau_response_patterns: bureauResponsePatterns,
    });
  } catch (error) {
    console.error('Error fetching dispute insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dispute insights' },
      { status: 500 }
    );
  }
}

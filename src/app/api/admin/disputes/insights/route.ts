import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { disputes, disputeOutcomes } from '@/db/schema';
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

function isMissingColumnError(error: unknown): boolean {
  const code = (error as { code?: string })?.code || (error as { cause?: { code?: string } })?.cause?.code;
  const message = (error as { message?: string })?.message || '';
  return code === '42703' || message.includes('does not exist');
}

function isMissingRelationError(error: unknown): boolean {
  const code = (error as { code?: string })?.code || (error as { cause?: { code?: string } })?.cause?.code;
  const message = (error as { message?: string })?.message || '';
  return code === '42P01' || message.includes('does not exist');
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

    let allDisputes: Array<{
      bureau: string;
      outcome: string | null;
      round: number | null;
      sentAt: Date | null;
      responseReceivedAt: Date | null;
      createdAt: Date | null;
      updatedAt: Date | null;
      methodology?: string | null;
      reasonCodes?: string | null;
      creditorName?: string | null;
    }>;

    try {
      allDisputes = await db
        .select()
        .from(disputes)
        .where(and(gte(disputes.createdAt, startDate)));
    } catch (queryError) {
      if (!isMissingColumnError(queryError)) {
        throw queryError;
      }

      // Backward compatibility for databases missing enhanced disputes columns.
      allDisputes = await db
        .select({
          bureau: disputes.bureau,
          outcome: disputes.outcome,
          round: disputes.round,
          sentAt: disputes.sentAt,
          responseReceivedAt: disputes.responseReceivedAt,
          createdAt: disputes.createdAt,
          updatedAt: disputes.updatedAt,
        })
        .from(disputes)
        .where(and(gte(disputes.createdAt, startDate)));
    }

    let outcomeRows: Array<{
      methodology?: string | null;
      round?: number | null;
      outcome?: string | null;
      reasonCodes?: string | null;
      creditorName?: string | null;
    }> = [];

    try {
      outcomeRows = await db
        .select()
        .from(disputeOutcomes)
        .where(and(gte(disputeOutcomes.createdAt, startDate)));
    } catch (queryError) {
      if (!isMissingRelationError(queryError)) {
        throw queryError;
      }
      // Database not fully migrated yet; keep insights available from disputes table only.
      outcomeRows = [];
    }

    if (allDisputes.length === 0 && outcomeRows.length === 0) {
      return NextResponse.json({
        range,
        avg_time_to_deletion_days: null,
        methodology_effectiveness: [],
        bureau_response_patterns: {},
        reason_code_effectiveness: [],
        creditor_effectiveness: [],
        recommendations: [],
      });
    }

    const dayMs = 24 * 60 * 60 * 1000;

    // Average time-to-deletion (use disputes for precise timing)
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

    const analysisSource = (outcomeRows.length > 0 ? outcomeRows : allDisputes).map((entry) => ({
      methodology: entry.methodology,
      round: entry.round,
      outcome: entry.outcome,
      reasonCodes: 'reasonCodes' in entry ? (entry as { reasonCodes?: string | null }).reasonCodes ?? null : null,
      creditorName: 'creditorName' in entry ? (entry as { creditorName?: string | null }).creditorName ?? null : null,
    }));

    // Methodology effectiveness
    const methodologyMap = new Map<
      string,
      { total: number; deleted: number; roundsSum: number }
    >();

    const reasonCodeMap = new Map<string, { total: number; deleted: number }>();
    const creditorMap = new Map<string, { total: number; deleted: number }>();

    const parseReasonCodes = (val: unknown) => {
      if (!val) return [] as string[];
      try {
        const parsed = typeof val === 'string' ? JSON.parse(val) : val;
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [] as string[];
      }
    };

    for (const entry of analysisSource) {
      const key = entry.methodology || 'standard';
      const mapEntry = methodologyMap.get(key) || { total: 0, deleted: 0, roundsSum: 0 };
      mapEntry.total++;
      mapEntry.roundsSum += (entry.round || 1);
      if (entry.outcome === 'deleted') mapEntry.deleted++;
      methodologyMap.set(key, mapEntry);

      const codes = parseReasonCodes(entry.reasonCodes);
      for (const code of codes) {
        const reasonEntry = reasonCodeMap.get(code) || { total: 0, deleted: 0 };
        reasonEntry.total++;
        if (entry.outcome === 'deleted') reasonEntry.deleted++;
        reasonCodeMap.set(code, reasonEntry);
      }

      if (entry.creditorName) {
        const creditorName = entry.creditorName;
        const credEntry = creditorMap.get(creditorName) || { total: 0, deleted: 0 };
        credEntry.total++;
        if (entry.outcome === 'deleted') credEntry.deleted++;
        creditorMap.set(creditorName, credEntry);
      }
    }

    const methodologyEffectiveness = Array.from(methodologyMap.entries())
      .map(([methodology, data]) => ({
        methodology,
        total: data.total,
        deleted: data.deleted,
        success_rate: data.total > 0 ? Math.round((data.deleted / data.total) * 100) : 0,
        avg_rounds: data.total > 0 ? Math.round((data.roundsSum / data.total) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.success_rate - a.success_rate)
      .slice(0, 5);

    const reasonCodeEffectiveness = Array.from(reasonCodeMap.entries())
      .map(([code, data]) => ({
        code,
        total: data.total,
        deleted: data.deleted,
        success_rate: data.total > 0 ? Math.round((data.deleted / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.success_rate - a.success_rate || b.total - a.total)
      .slice(0, 5);

    const creditorEffectiveness = Array.from(creditorMap.entries())
      .map(([creditor, data]) => ({
        creditor,
        total: data.total,
        deleted: data.deleted,
        success_rate: data.total > 0 ? Math.round((data.deleted / data.total) * 100) : 0,
      }))
      .sort((a, b) => b.deleted - a.deleted)
      .slice(0, 5);

    // Bureau response patterns (keep using disputes for timing context)
    const bureauStats: Record<string, { total: number; deleted: number; noResponse: number; responseDaysSum: number; responseCount: number; }> = {};

    for (const d of allDisputes) {
      const bureau = d.bureau || 'unknown';
      if (!bureauStats[bureau]) {
        bureauStats[bureau] = { total: 0, deleted: 0, noResponse: 0, responseDaysSum: 0, responseCount: 0 };
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

    const bureauResponsePatterns = Object.entries(bureauStats).reduce((acc, [bureau, s]) => {
      const avgResponseDays = s.responseCount ? Math.round((s.responseDaysSum / s.responseCount) * 10) / 10 : null;
      const deletedRate = s.total ? Math.round((s.deleted / s.total) * 100) : 0;
      const noResponseRate = s.total ? Math.round((s.noResponse / s.total) * 100) : 0;

      acc[bureau] = {
        total: s.total,
        avg_response_days: avgResponseDays,
        deleted_rate: deletedRate,
        no_response_rate: noResponseRate,
      };
      return acc;
    }, {} as Record<string, { total: number; avg_response_days: number | null; deleted_rate: number; no_response_rate: number; }>);

    const recommendations: string[] = [];
    if (methodologyEffectiveness[0]) {
      recommendations.push(`Lean on ${methodologyEffectiveness[0].methodology} methodology (success ${methodologyEffectiveness[0].success_rate}%) for similar items.`);
    }
    if (reasonCodeEffectiveness[0]) {
      recommendations.push(`Reason code "${reasonCodeEffectiveness[0].code}" is currently the top performer (${reasonCodeEffectiveness[0].success_rate}%).`);
    }
    if (creditorEffectiveness[0]) {
      recommendations.push(`Creditor "${creditorEffectiveness[0].creditor}" shows highest deletion count; mirror that strategy for repeat furnishers.`);
    }

    return NextResponse.json({
      range,
      avg_time_to_deletion_days: avgTimeToDeletionDays,
      methodology_effectiveness: methodologyEffectiveness,
      bureau_response_patterns: bureauResponsePatterns,
      reason_code_effectiveness: reasonCodeEffectiveness,
      creditor_effectiveness: creditorEffectiveness,
      recommendations,
    });
  } catch (error) {
    console.error('Error fetching dispute insights:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dispute insights' },
      { status: 500 }
    );
  }
}

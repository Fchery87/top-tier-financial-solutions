import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { creditAccounts, disputeOutcomes, negativeItems } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { triageItems } from '@/lib/dispute-triage';
import { buildCreditorStrategyInsights } from '@/lib/creditor-strategy-insights';

async function validateAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.email) return null;
  const ok = await isSuperAdmin(session.user.email);
  return ok ? session.user : null;
}

export async function POST(request: NextRequest) {
  const admin = await validateAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientId, round = 1, itemIds }: { clientId?: string; round?: number; itemIds?: string[] } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const where = itemIds && itemIds.length > 0
      ? and(eq(negativeItems.clientId, clientId), inArray(negativeItems.id, itemIds))
      : eq(negativeItems.clientId, clientId);

    const items = await db
      .select({
        id: negativeItems.id,
        creditorName: negativeItems.creditorName,
        originalCreditor: negativeItems.originalCreditor,
        accountNumber: creditAccounts.accountNumber,
        itemType: negativeItems.itemType,
        amount: negativeItems.amount,
        dateReported: negativeItems.dateReported,
        dateOfFirstDelinquency: negativeItems.dateOfFirstDelinquency,
        bureauStatedRemovalDate: negativeItems.bureauStatedRemovalDate,
        dateOfLastActivity: negativeItems.dateOfLastActivity,
        riskSeverity: negativeItems.riskSeverity,
        recommendedAction: negativeItems.recommendedAction,
        onTransunion: negativeItems.onTransunion,
        onExperian: negativeItems.onExperian,
        onEquifax: negativeItems.onEquifax,
        bureau: negativeItems.bureau,
        transunionStatus: negativeItems.transunionStatus,
        experianStatus: negativeItems.experianStatus,
        equifaxStatus: negativeItems.equifaxStatus,
        accountType: creditAccounts.accountType,
        paymentHistoryGrid: creditAccounts.paymentHistoryGrid,
      })
      .from(negativeItems)
      .leftJoin(creditAccounts, eq(negativeItems.creditAccountId, creditAccounts.id))
      .where(where);

    const triageReady = items.map((item) => {
      let paymentHistoryGrid: Record<string, Record<string, string>> | null = null;
      try {
        if (item.paymentHistoryGrid) {
          paymentHistoryGrid = JSON.parse(item.paymentHistoryGrid) as Record<string, Record<string, string>>;
        }
      } catch {
        paymentHistoryGrid = null;
      }

      return {
        id: item.id,
        creditorName: item.creditorName,
        originalCreditor: item.originalCreditor,
        accountNumber: null,
        itemType: item.itemType,
        accountType: item.accountType,
        paymentHistoryGrid,
        amount: item.amount,
        dateReported: item.dateReported?.toISOString() ?? null,
        dateOfFirstDelinquency: item.dateOfFirstDelinquency?.toISOString() ?? null,
        bureauStatedRemovalDate: item.bureauStatedRemovalDate?.toISOString() ?? null,
        dateOfLastActivity: item.dateOfLastActivity?.toISOString() ?? null,
        riskSeverity: item.riskSeverity ?? 'medium',
        recommendedAction: item.recommendedAction,
        onTransunion: item.onTransunion ?? undefined,
        onExperian: item.onExperian ?? undefined,
        onEquifax: item.onEquifax ?? undefined,
        bureau: item.bureau ?? null,
        transunionStatus: item.transunionStatus,
        experianStatus: item.experianStatus,
        equifaxStatus: item.equifaxStatus,
      };
    });

    // Historical per-creditor strategy learning across all recorded outcomes.
    // Advisory only — the deterministic policy engine still gates what is allowed.
    let insights = buildCreditorStrategyInsights([]);
    try {
      const outcomeRows = await db
        .select({
          creditorName: disputeOutcomes.creditorName,
          methodology: disputeOutcomes.methodology,
          itemType: disputeOutcomes.itemType,
          outcome: disputeOutcomes.outcome,
        })
        .from(disputeOutcomes);
      insights = buildCreditorStrategyInsights(outcomeRows);
    } catch (insightError) {
      console.error('Error loading creditor strategy history for triage:', insightError);
    }

    const summary = triageItems(triageReady, round, insights);

    return NextResponse.json({
      success: true,
      round,
      items: triageReady.length,
      historicalRecommendations: summary.historicalRecommendations || {},
      ...summary,
    });
  } catch (error) {
    console.error('Error triaging disputes:', error);
    return NextResponse.json({ error: 'Failed to triage items' }, { status: 500 });
  }
}

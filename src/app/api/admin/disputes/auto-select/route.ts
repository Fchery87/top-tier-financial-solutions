import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { creditAccounts, negativeItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  analyzeNegativeItems,
  consolidateReasonCodes,
  getBestMethodologyForBatch,
} from '@/lib/ai-letter-generator';
import { requireLatestApprovedReportForClient } from '@/lib/parser-review-gate';
import { buildCreditorStrategyInsights, getRecommendedMethodologyForCreditor } from '@/lib/creditor-strategy-insights';
import { disputeOutcomes } from '@/db/schema';

async function validateAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.email) return null;

  const adminOk = await isSuperAdmin(session.user.email);
  if (!adminOk) return null;

  return session.user;
}

export async function POST(request: Request) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientId, round = 1 } = body || {};

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const reportGate = await requireLatestApprovedReportForClient(clientId);
    if (!reportGate.allowed) {
      return NextResponse.json(
        { error: reportGate.reason || 'The latest credit report must be approved before auto-select.' },
        { status: 409 }
      );
    }

    // Pull all negative items for the client with related account data to improve analysis quality
    const items = await db
      .select({
        id: negativeItems.id,
        creditorName: negativeItems.creditorName,
        originalCreditor: negativeItems.originalCreditor,
        itemType: negativeItems.itemType,
        amount: negativeItems.amount,
        dateReported: negativeItems.dateReported,
        dateOfFirstDelinquency: negativeItems.dateOfFirstDelinquency,
        bureauStatedRemovalDate: negativeItems.bureauStatedRemovalDate,
        dateOfLastActivity: negativeItems.dateOfLastActivity,
        bureau: negativeItems.bureau,
        riskSeverity: negativeItems.riskSeverity,
        accountStatus: creditAccounts.accountStatus,
        accountType: creditAccounts.accountType,
        balance: creditAccounts.balance,
        creditLimit: creditAccounts.creditLimit,
        highCredit: creditAccounts.highCredit,
        pastDueAmount: creditAccounts.pastDueAmount,
        paymentStatus: creditAccounts.paymentStatus,
        dateOpened: creditAccounts.dateOpened,
        remarks: creditAccounts.remarks,
      })
      .from(negativeItems)
      .leftJoin(creditAccounts, eq(negativeItems.creditAccountId, creditAccounts.id))
      .where(eq(negativeItems.clientId, clientId));

    if (items.length === 0) {
      return NextResponse.json({
        recommended_item_ids: [],
        analyses: [],
        summary: { total_items: 0, recommended_count: 0 },
      });
    }

    const analyses = analyzeNegativeItems(
      items.map((item) => ({
        id: item.id,
        creditorName: item.creditorName,
        originalCreditor: item.originalCreditor,
        itemType: item.itemType,
        amount: item.amount,
        dateReported: item.dateReported?.toISOString() || null,
        dateOfFirstDelinquency: item.dateOfFirstDelinquency?.toISOString() || null,
        bureauStatedRemovalDate: item.bureauStatedRemovalDate?.toISOString() || null,
        dateOfLastActivity: item.dateOfLastActivity?.toISOString() || null,
        bureau: item.bureau,
        riskSeverity: item.riskSeverity,
        accountStatus: item.accountStatus,
        accountType: item.accountType,
        currentBalance: item.balance,
        creditLimit: item.creditLimit,
        highCredit: item.highCredit,
        pastDueAmount: item.pastDueAmount,
        paymentStatus: item.paymentStatus,
        dateOpened: item.dateOpened?.toISOString() || null,
        remarks: item.remarks,
      })),
      round,
    );

    const isDisputable = (confidence: number, metro2Count: number, fcraCount: number, reasonCount: number) => {
      if (confidence >= 0.6) return true;
      if (metro2Count > 0 || fcraCount > 0) return true;
      return reasonCount > 0;
    };

    const recommendedAnalyses = analyses.filter((a) =>
      isDisputable(a.confidence, a.metro2Violations.length, a.fcraIssues.length, a.autoReasonCodes.length),
    );

    const recommendedItemIds = recommendedAnalyses.map((a) => a.itemId);
    const recommendedReasonCodes = consolidateReasonCodes(recommendedAnalyses);

    let recommendedMethodology = getBestMethodologyForBatch(
      recommendedAnalyses.length > 0 ? recommendedAnalyses : analyses,
    );

    try {
      const outcomeRows = await db
        .select({
          creditorName: disputeOutcomes.creditorName,
          methodology: disputeOutcomes.methodology,
          itemType: disputeOutcomes.itemType,
          outcome: disputeOutcomes.outcome,
        })
        .from(disputeOutcomes);
      const insights = buildCreditorStrategyInsights(outcomeRows);
      const prioritizedCreditor = items.find(item => recommendedItemIds.includes(item.id))?.creditorName ?? items[0]?.creditorName;
      const historicalMethodology = prioritizedCreditor
        ? getRecommendedMethodologyForCreditor(prioritizedCreditor, insights)
        : null;
      if (historicalMethodology && round === 1) {
        recommendedMethodology = historicalMethodology;
      }
    } catch (historyError) {
      console.error('Error loading historical methodology recommendations for auto-select:', historyError);
    }
    const averageConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;

    return NextResponse.json({
      recommended_item_ids: recommendedItemIds,
      analyses,
      summary: {
        itemCount: analyses.length,
        recommendedCount: recommendedItemIds.length,
        recommendedMethodology,
        recommendedReasonCodes,
        allReasonCodes: recommendedReasonCodes,
        allMetro2Violations: recommendedAnalyses.flatMap((analysis) => analysis.metro2Violations),
        allFcraIssues: recommendedAnalyses.flatMap((analysis) => analysis.fcraIssues),
        averageConfidence: Math.round(averageConfidence * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Error auto-selecting disputable items:', error);
    return NextResponse.json({ error: 'Failed to auto-select disputable items' }, { status: 500 });
  }
}

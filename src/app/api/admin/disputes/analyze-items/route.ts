import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { negativeItems, creditAccounts } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import {
  analyzeNegativeItems,
  getBestMethodologyForBatch,
  consolidateReasonCodes,
} from '@/lib/ai-letter-generator';

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

export async function POST(request: Request) {
  const user = await validateAdmin();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { itemIds, round = 1 } = body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json(
        { error: 'itemIds array is required' },
        { status: 400 }
      );
    }

    // Fetch the negative items from database with related credit account data for Metro 2 analysis
    const items = await db
      .select({
        // Negative item fields
        id: negativeItems.id,
        creditorName: negativeItems.creditorName,
        originalCreditor: negativeItems.originalCreditor,
        itemType: negativeItems.itemType,
        amount: negativeItems.amount,
        dateReported: negativeItems.dateReported,
        dateOfLastActivity: negativeItems.dateOfLastActivity,
        bureau: negativeItems.bureau,
        riskSeverity: negativeItems.riskSeverity,
        creditAccountId: negativeItems.creditAccountId,
        // Related credit account fields for Metro 2 analysis
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
      .where(inArray(negativeItems.id, itemIds));

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'No items found with provided IDs' },
        { status: 404 }
      );
    }

    // Transform items for analysis with all available Metro 2 data
    const itemsForAnalysis = items.map(item => ({
      id: item.id,
      creditorName: item.creditorName,
      originalCreditor: item.originalCreditor,
      itemType: item.itemType,
      amount: item.amount,
      dateReported: item.dateReported?.toISOString() || null,
      dateOfLastActivity: item.dateOfLastActivity?.toISOString() || null,
      bureau: item.bureau,
      riskSeverity: item.riskSeverity,
      // Metro 2 relevant fields from credit account
      accountStatus: item.accountStatus,
      accountType: item.accountType,
      currentBalance: item.balance,
      creditLimit: item.creditLimit,
      highCredit: item.highCredit,
      pastDueAmount: item.pastDueAmount,
      paymentStatus: item.paymentStatus,
      dateOpened: item.dateOpened?.toISOString() || null,
      remarks: item.remarks,
    }));

    // Run AI analysis on all items
    const analyses = analyzeNegativeItems(itemsForAnalysis, round);

    // Get best methodology for the batch
    const recommendedMethodology = getBestMethodologyForBatch(analyses);

    // Consolidate all reason codes
    const allReasonCodes = consolidateReasonCodes(analyses);

    // Consolidate all Metro 2 violations and FCRA issues
    const allMetro2Violations = [...new Set(analyses.flatMap(a => a.metro2Violations))];
    const allFcraIssues = [...new Set(analyses.flatMap(a => a.fcraIssues))];

    // Calculate overall confidence
    const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;

    return NextResponse.json({
      analyses,
      summary: {
        itemCount: analyses.length,
        recommendedMethodology,
        allReasonCodes,
        allMetro2Violations,
        allFcraIssues,
        averageConfidence: Math.round(avgConfidence * 100) / 100,
        analysisNotes: analyses.map(a => `${a.creditorName}: ${a.analysisNotes}`).join('\n'),
      },
    });
  } catch (error) {
    console.error('Error analyzing items:', error);
    return NextResponse.json(
      { error: 'Failed to analyze items' },
      { status: 500 }
    );
  }
}

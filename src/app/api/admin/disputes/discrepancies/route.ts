import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { bureauDiscrepancies } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

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

export interface DiscrepancyWithRecommendation {
  id: string;
  discrepancyType: string;
  field: string | null;
  creditorName: string | null;
  accountNumber: string | null;
  valueTransunion: string | null;
  valueExperian: string | null;
  valueEquifax: string | null;
  severity: string;
  isDisputable: boolean;
  disputeRecommendation: string | null;
  bureausAffected: string[];
  suggestedReasonCode: string;
  legalBasis: string;
}

// GET /api/admin/disputes/discrepancies?clientId=xxx
export async function GET(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');

  if (!clientId) {
    return NextResponse.json(
      { error: 'clientId is required' },
      { status: 400 }
    );
  }

  try {
    // Fetch all unresolved discrepancies for this client
    const discrepancies = await db
      .select()
      .from(bureauDiscrepancies)
      .where(
        and(
          eq(bureauDiscrepancies.clientId, clientId),
          isNull(bureauDiscrepancies.resolvedAt)
        )
      );

    // Enhance each discrepancy with dispute recommendations
    const enhancedDiscrepancies: DiscrepancyWithRecommendation[] = discrepancies.map(d => {
      const bureausAffected: string[] = [];
      if (d.valueTransunion) bureausAffected.push('transunion');
      if (d.valueExperian) bureausAffected.push('experian');
      if (d.valueEquifax) bureausAffected.push('equifax');

      // Determine suggested reason code based on discrepancy type
      let suggestedReasonCode = 'verification_required';
      let legalBasis = 'FCRA Section 611 - Right to dispute inaccurate information';

      switch (d.discrepancyType) {
        case 'account_balance':
          suggestedReasonCode = 'balance_discrepancy';
          legalBasis = 'FCRA Section 607(b) - Maximum possible accuracy required. Different bureaus report different balances, indicating at least one is inaccurate.';
          break;
        case 'account_status':
          suggestedReasonCode = 'status_inconsistency';
          legalBasis = 'FCRA Section 607(b) & Metro 2 Format Requirements - Account status codes must be accurate and consistent across all reporting.';
          break;
        case 'payment_history':
          suggestedReasonCode = 'status_inconsistency';
          legalBasis = 'FCRA Section 623(a)(2) - Furnishers must report accurate payment history. Inconsistent reporting indicates violation.';
          break;
        case 'date_mismatch':
          suggestedReasonCode = 'wrong_dates';
          legalBasis = 'Metro 2 Field Requirements - Dates must be accurate for FCRA 7-year calculation and DOFD compliance.';
          break;
        case 'account_missing':
          suggestedReasonCode = 'verification_required';
          legalBasis = 'Account appears on some bureaus but not others - requires verification of accuracy.';
          break;
        case 'pii_name':
        case 'pii_address':
          suggestedReasonCode = 'verification_required';
          legalBasis = 'FCRA Section 607(b) - Personal information must be accurate across all bureaus.';
          break;
      }

      return {
        id: d.id,
        discrepancyType: d.discrepancyType,
        field: d.field,
        creditorName: d.creditorName,
        accountNumber: d.accountNumber,
        valueTransunion: d.valueTransunion,
        valueExperian: d.valueExperian,
        valueEquifax: d.valueEquifax,
        severity: d.severity || 'medium',
        isDisputable: d.isDisputable ?? true,
        disputeRecommendation: d.disputeRecommendation,
        bureausAffected,
        suggestedReasonCode,
        legalBasis,
      };
    });

    // Group by severity for easier UI rendering
    const grouped = {
      high: enhancedDiscrepancies.filter(d => d.severity === 'high'),
      medium: enhancedDiscrepancies.filter(d => d.severity === 'medium'),
      low: enhancedDiscrepancies.filter(d => d.severity === 'low'),
    };

    return NextResponse.json({
      discrepancies: enhancedDiscrepancies,
      grouped,
      summary: {
        total: enhancedDiscrepancies.length,
        highSeverity: grouped.high.length,
        mediumSeverity: grouped.medium.length,
        lowSeverity: grouped.low.length,
        disputable: enhancedDiscrepancies.filter(d => d.isDisputable).length,
      },
    });
  } catch (error) {
    console.error('Error fetching discrepancies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch discrepancies' },
      { status: 500 }
    );
  }
}

// POST /api/admin/disputes/discrepancies/resolve
export async function POST(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { discrepancyId, resolution } = body;

    if (!discrepancyId) {
      return NextResponse.json(
        { error: 'discrepancyId is required' },
        { status: 400 }
      );
    }

    // Mark discrepancy as resolved
    await db
      .update(bureauDiscrepancies)
      .set({
        resolvedAt: new Date(),
        notes: resolution || 'Resolved via dispute wizard',
      })
      .where(eq(bureauDiscrepancies.id, discrepancyId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resolving discrepancy:', error);
    return NextResponse.json(
      { error: 'Failed to resolve discrepancy' },
      { status: 500 }
    );
  }
}

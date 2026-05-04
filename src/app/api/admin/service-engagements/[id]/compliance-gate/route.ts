import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceGateChecks, serviceEngagements } from '@/db/schema';
import { buildComplianceGateStatus } from '@/lib/compliance-gate';
import { getAdminSessionUser } from '@/lib/admin-session';

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function validateAdmin() {
  return getAdminSessionUser('super_admin');
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const [engagement] = await db
      .select({ id: serviceEngagements.id })
      .from(serviceEngagements)
      .where(eq(serviceEngagements.id, id))
      .limit(1);

    if (!engagement) {
      return NextResponse.json({ error: 'Service engagement not found' }, { status: 404 });
    }

    const records = await db
      .select({
        checkKey: complianceGateChecks.checkKey,
        passed: complianceGateChecks.passed,
        checkedAt: complianceGateChecks.checkedAt,
        notes: complianceGateChecks.notes,
      })
      .from(complianceGateChecks)
      .where(eq(complianceGateChecks.engagementId, id));

    return NextResponse.json({
      engagement_id: id,
      ...buildComplianceGateStatus(records),
    });
  } catch (error) {
    console.error('Error fetching compliance gate status:', error);
    return NextResponse.json({ error: 'Failed to fetch compliance gate status' }, { status: 500 });
  }
}

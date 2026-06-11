import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { disputeOutcomes } from '@/db/schema';
import { buildCreditorStrategyInsights } from '@/lib/creditor-strategy-insights';

async function validateAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.email) return null;
  const ok = await isSuperAdmin(session.user.email);
  return ok ? session.user : null;
}

export async function GET() {
  const admin = await validateAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await db
      .select({
        creditorName: disputeOutcomes.creditorName,
        methodology: disputeOutcomes.methodology,
        itemType: disputeOutcomes.itemType,
        outcome: disputeOutcomes.outcome,
      })
      .from(disputeOutcomes);

    const summary = buildCreditorStrategyInsights(rows);

    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error('Error building creditor strategy insights:', error);
    return NextResponse.json({ error: 'Failed to build creditor strategy insights' }, { status: 500 });
  }
}

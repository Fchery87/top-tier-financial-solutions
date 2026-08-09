import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/admin-session';
import { db } from '@/db/client';
import { disputeOutcomes } from '@/db/schema';
import { buildCreditorStrategyInsights } from '@/lib/creditor-strategy-insights';
import { logServerEvent } from '@/lib/server-logger';

export async function GET() {
  const admin = await requireCapability('disputes:read');
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
    logServerEvent({ level: 'error', event: 'server.app.api.admin.disputes.insights.creditor.strategies.error', error: error });
    return NextResponse.json({ error: 'Failed to build creditor strategy insights' }, { status: 500 });
  }
}

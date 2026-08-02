import { NextRequest, NextResponse } from 'next/server';
import { requireCapability } from '@/lib/admin-session';
import { recordAdminActivity } from '@/lib/admin-activity';
import { db } from '@/db/client';
import {
  runDisputeEscalationAutomation,
  writeDisputeEscalationFailure,
} from '@/lib/dispute-escalation-runner';

export async function POST(request: NextRequest) {
  const adminUser = await requireCapability('settings:write');
  if (!adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({})) as { dryRun?: boolean };
    const dryRun = !!body.dryRun;

    const result = await runDisputeEscalationAutomation({ dryRun });
    await db.transaction(async (tx) => {
      await recordAdminActivity(tx, {
        actorUserId: adminUser.id,
        action: 'automation.dispute_escalations.run',
        subjectType: 'automation',
        metadata: { dryRun },
      });
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error running manual dispute escalation automation:', error);
    try {
      await writeDisputeEscalationFailure(error);
    } catch (settingsError) {
      console.error('Error writing dispute escalation failure metadata:', settingsError);
    }
    return NextResponse.json({ error: 'Failed to run dispute escalation automation' }, { status: 500 });
  }
}

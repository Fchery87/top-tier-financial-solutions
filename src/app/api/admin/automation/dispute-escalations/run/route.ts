import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionUser } from '@/lib/admin-session';
import {
  runDisputeEscalationAutomation,
  writeDisputeEscalationFailure,
} from '@/lib/dispute-escalation-runner';

export async function POST(request: NextRequest) {
  const adminUser = await getAdminSessionUser('super_admin');
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({})) as { dryRun?: boolean };
    const dryRun = !!body.dryRun;

    const result = await runDisputeEscalationAutomation({ dryRun });
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

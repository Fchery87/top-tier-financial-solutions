import { NextRequest, NextResponse } from 'next/server';
import { isDryRunRequested } from '@/lib/dispute-automation';
import {
  runDisputeEscalationAutomation,
  writeDisputeEscalationFailure,
} from '@/lib/dispute-escalation-runner';
import { logServerEvent } from '@/lib/server-logger';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dryRun = isDryRunRequested(request.nextUrl.searchParams.get('dry_run'));
    const result = await runDisputeEscalationAutomation({ dryRun });
    return NextResponse.json(result);
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.cron.dispute.escalations.error', error: error });
    try {
      await writeDisputeEscalationFailure(error);
    } catch (settingsError) {
      logServerEvent({ level: 'error', event: 'server.app.api.cron.dispute.escalations.error', error: settingsError });
    }
    return NextResponse.json(
      { error: 'Failed to run dispute escalation automation' },
      { status: 500 }
    );
  }
}

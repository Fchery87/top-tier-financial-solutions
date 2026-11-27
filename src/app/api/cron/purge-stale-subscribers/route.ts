import { NextRequest, NextResponse } from 'next/server';
import { logServerEvent } from '@/lib/server-logger';
import { cleanUpStalePendingSubscribers } from '@/lib/newsletter-pending-cleanup';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await cleanUpStalePendingSubscribers();
    return NextResponse.json({
      success: true,
      deleted: result.deleted,
      restored_to_unsubscribed: result.restoredToUnsubscribed,
    });
  } catch (error) {
    logServerEvent({ level: 'error', event: 'server.app.api.cron.purge_stale_subscribers.error', error });
    return NextResponse.json({ error: 'Failed to clean up pending subscribers' }, { status: 500 });
  }
}

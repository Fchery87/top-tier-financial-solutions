import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, tasks } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { triggerAutomation } from '@/lib/email-service';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const taskRows = await db
      .select({
        clientId: tasks.clientId,
        status: tasks.status,
        visibleToClient: tasks.visibleToClient,
        isBlocking: tasks.isBlocking,
        createdAt: tasks.createdAt,
        dueDate: tasks.dueDate,
        title: tasks.title,
      })
      .from(tasks);

    const blockingByClient = new Map<string, typeof taskRows>();

    for (const row of taskRows) {
      if (!row.clientId) continue;
      if (!row.visibleToClient || !row.isBlocking || row.status === 'done') continue;

      const existing = blockingByClient.get(row.clientId) || [];
      existing.push(row);
      blockingByClient.set(row.clientId, existing);
    }

    if (blockingByClient.size === 0) {
      return NextResponse.json({ success: true, nudged_clients: 0 });
    }

    const clientIds = Array.from(blockingByClient.keys());

    const clientRows = await db
      .select({
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        email: clients.email,
      })
      .from(clients)
      .where(inArray(clients.id, clientIds));

    const clientById = new Map<string, (typeof clientRows)[number]>();
    for (const c of clientRows) {
      clientById.set(c.id, c);
    }

    const now = new Date();
    let nudged = 0;

    for (const [clientId, clientTasks] of blockingByClient.entries()) {
      const client = clientById.get(clientId);
      if (!client) continue;

      let waitingSince: Date | null = null;
      for (const task of clientTasks) {
        const candidate = task.dueDate || task.createdAt;
        if (!candidate) continue;
        if (!waitingSince || candidate < waitingSince) {
          waitingSince = candidate;
        }
      }

      if (!waitingSince) continue;

      const waitingDays = Math.floor(
        (now.getTime() - waitingSince.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Only nudge clients who have been blocking progress for 7+ days
      if (waitingDays < 7) continue;

      try {
        await triggerAutomation(
          'progress_report',
          clientId,
          {
            client_name: `${client.firstName} ${client.lastName}`,
            client_first_name: client.firstName,
            client_email: client.email,
            blocking_task_count: clientTasks.length,
            primary_task_title: clientTasks[0]?.title || '',
            waiting_days: waitingDays,
            trigger_reason: 'auto_waiting_on_client',
            waiting_since: waitingSince.toISOString(),
            kind: 'client_stalled_nudge_auto',
          },
        );
        nudged += 1;
      } catch (emailError) {
        console.error('Error sending auto stalled-client reminder:', emailError);
      }
    }

    return NextResponse.json({ success: true, nudged_clients: nudged });
  } catch (error) {
    console.error('Error running stalled client nudge cron:', error);
    return NextResponse.json(
      { error: 'Failed to run stalled client check' },
      { status: 500 },
    );
  }
}

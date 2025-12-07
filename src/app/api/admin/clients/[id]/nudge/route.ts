import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, tasks } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { eq } from 'drizzle-orm';
import { triggerAutomation } from '@/lib/email-service';

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({} as { reason?: string }));
    const reason = (body && body.reason) || 'waiting_on_client';

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const taskRows = await db
      .select({
        status: tasks.status,
        visibleToClient: tasks.visibleToClient,
        isBlocking: tasks.isBlocking,
        createdAt: tasks.createdAt,
        dueDate: tasks.dueDate,
        title: tasks.title,
      })
      .from(tasks)
      .where(eq(tasks.clientId, id));

    const blockingTasks = taskRows.filter(
      (t) => t.visibleToClient && t.isBlocking && t.status !== 'done',
    );

    if (blockingTasks.length === 0) {
      return NextResponse.json(
        { error: 'No open blocking client tasks to send a reminder for' },
        { status: 400 },
      );
    }

    let waitingSince: Date | null = null;
    for (const task of blockingTasks) {
      const candidate = task.dueDate || task.createdAt;
      if (!candidate) continue;
      if (!waitingSince || candidate < waitingSince) {
        waitingSince = candidate;
      }
    }

    const now = new Date();
    const waitingDays = waitingSince
      ? Math.floor((now.getTime() - waitingSince.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Best-effort: fire a progress report automation as a "stalled client" reminder
    try {
      await triggerAutomation('progress_report', id, {
        client_name: `${client.firstName} ${client.lastName}`,
        client_first_name: client.firstName,
        client_email: client.email,
        blocking_task_count: blockingTasks.length,
        primary_task_title: blockingTasks[0]?.title || '',
        waiting_days: waitingDays,
        trigger_reason: reason,
        waiting_since: waitingSince?.toISOString() ?? null,
        triggered_by: adminUser.id,
        kind: 'client_stalled_nudge',
      });
    } catch (emailError) {
      console.error('Error sending stalled client reminder email:', emailError);
      // Do not fail the request solely because email failed
    }

    return NextResponse.json({
      success: true,
      blocking_tasks: blockingTasks.length,
      waiting_days: waitingDays,
    });
  } catch (error) {
    console.error('Error sending client nudge:', error);
    return NextResponse.json(
      { error: 'Failed to send client reminder' },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { and, count, eq, isNull, lt, lte, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { auth } from '@/lib/auth';
import { creditReports, disputeCycles, disputes, servicesRenderedEvents, tasks } from '@/db/schema';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';

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

function firstCount(rows: { count: number }[]) {
  return Number(rows[0]?.count ?? 0);
}

export async function GET(_request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const [
      pendingOrFailedReports,
      dueSoonResponses,
      overdueResponses,
      activeCycles,
      servicesRendered,
      openTasks,
    ] = await Promise.all([
      db.select({ count: count() }).from(creditReports).where(or(eq(creditReports.parseStatus, 'pending'), eq(creditReports.parseStatus, 'failed'))),
      db.select({ count: count() }).from(disputes).where(and(
        or(eq(disputes.status, 'sent'), eq(disputes.status, 'in_progress')),
        lte(disputes.responseDeadline, sevenDaysFromNow),
        isNull(disputes.responseReceivedAt),
      )),
      db.select({ count: count() }).from(disputes).where(and(
        or(eq(disputes.status, 'sent'), eq(disputes.status, 'in_progress')),
        lt(disputes.responseDeadline, now),
        isNull(disputes.responseReceivedAt),
      )),
      db.select({ count: count() }).from(disputeCycles).where(or(eq(disputeCycles.status, 'ready'), eq(disputeCycles.status, 'sent'))),
      db.select({ count: count() }).from(servicesRenderedEvents).where(eq(servicesRenderedEvents.eventType, 'first_dispute_package_submitted')),
      db.select({ count: count() }).from(tasks).where(or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'), eq(tasks.status, 'review'))),
    ]);

    return NextResponse.json({
      operator_analytics: {
        import_success: {
          pending_or_failed_reports: firstCount(pendingOrFailedReports),
        },
        response_aging: {
          due_soon: firstCount(dueSoonResponses),
          overdue: firstCount(overdueResponses),
        },
        cycle_throughput: {
          active_cycles: firstCount(activeCycles),
        },
        billing_readiness: {
          services_rendered_events: firstCount(servicesRendered),
        },
        workload: {
          open_tasks: firstCount(openTasks),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching operator analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch operator analytics' }, { status: 500 });
  }
}

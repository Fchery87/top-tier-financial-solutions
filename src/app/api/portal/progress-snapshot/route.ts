import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { auth } from '@/lib/auth';
import {
  clientDocuments,
  clients,
  creditReports,
  disputeCycles,
  disputes,
  serviceEngagements,
  tasks,
} from '@/db/schema';
import { headers } from 'next/headers';
import { buildDocumentChecklist } from '@/lib/document-checklist';
import { buildClientProgressSnapshot } from '@/lib/client-progress-snapshot';

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return null;
  }

  return session.user;
}

export async function GET(_request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.userId, user.id))
      .limit(1);

    if (!client) {
      return NextResponse.json({ snapshot: null });
    }

    const [engagement] = await db
      .select({ id: serviceEngagements.id, lifecycleStage: serviceEngagements.lifecycleStage })
      .from(serviceEngagements)
      .where(and(
        eq(serviceEngagements.clientId, client.id),
        eq(serviceEngagements.status, 'active'),
      ))
      .limit(1);

    const visibleTasks = await db
      .select({
        status: tasks.status,
        visibleToClient: tasks.visibleToClient,
        isBlocking: tasks.isBlocking,
      })
      .from(tasks)
      .where(eq(tasks.clientId, client.id));

    const documents = await db
      .select({ fileType: clientDocuments.fileType })
      .from(clientDocuments)
      .where(eq(clientDocuments.userId, user.id));

    const cycles = await db
      .select({ status: disputeCycles.status })
      .from(disputeCycles)
      .where(eq(disputeCycles.clientId, client.id));

    const reviewedDisputes = await db
      .select({ outcome: disputes.outcome })
      .from(disputes)
      .where(eq(disputes.clientId, client.id));

    const reportPulls = await db
      .select({ id: creditReports.id })
      .from(creditReports)
      .where(
        engagement
          ? eq(creditReports.serviceEngagementId, engagement.id)
          : eq(creditReports.clientId, client.id),
      );

    const documentChecklist = buildDocumentChecklist(documents);

    return NextResponse.json({
      snapshot: buildClientProgressSnapshot({
        engagement,
        tasks: visibleTasks,
        documentChecklist,
        cycles,
        disputes: reviewedDisputes,
        reportPulls,
      }),
    });
  } catch (error) {
    console.error('Error fetching portal progress snapshot:', error);
    return NextResponse.json({ error: 'Failed to fetch progress snapshot' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { clientDocuments, clients, complianceGateChecks, serviceEngagements } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { buildComplianceGateStatus } from '@/lib/compliance-gate';
import { buildDocumentChecklist } from '@/lib/document-checklist';

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
      return NextResponse.json({ engagement_id: null, blockers: [], is_ready_for_first_work: false });
    }

    const [engagement] = await db
      .select({ id: serviceEngagements.id, lifecycleStage: serviceEngagements.lifecycleStage })
      .from(serviceEngagements)
      .where(and(
        eq(serviceEngagements.clientId, client.id),
        eq(serviceEngagements.status, 'active'),
      ))
      .limit(1);

    if (!engagement) {
      return NextResponse.json({ engagement_id: null, blockers: [], is_ready_for_first_work: false });
    }

    const records = await db
      .select({
        checkKey: complianceGateChecks.checkKey,
        passed: complianceGateChecks.passed,
        checkedAt: complianceGateChecks.checkedAt,
        notes: complianceGateChecks.notes,
      })
      .from(complianceGateChecks)
      .where(eq(complianceGateChecks.engagementId, engagement.id));

    const gate = buildComplianceGateStatus(records);
    const blockers = gate.checks
      .filter((check) => !check.passed)
      .map((check) => ({ key: check.key, label: check.label }));

    const documents = await db
      .select({ fileType: clientDocuments.fileType })
      .from(clientDocuments)
      .where(eq(clientDocuments.userId, user.id));

    return NextResponse.json({
      engagement_id: engagement.id,
      lifecycle_stage: engagement.lifecycleStage,
      is_ready_for_first_work: gate.is_ready_for_first_work,
      blockers,
      document_checklist: buildDocumentChecklist(documents),
    });
  } catch (error) {
    console.error('Error fetching portal onboarding blockers:', error);
    return NextResponse.json({ error: 'Failed to fetch onboarding blockers' }, { status: 500 });
  }
}

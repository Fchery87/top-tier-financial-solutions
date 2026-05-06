import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { complianceGateChecks, disputes, servicesRenderedEvents } from '@/db/schema';
import { getAdminSessionUser } from '@/lib/admin-session';
import { evaluateComplianceGateAction } from '@/lib/compliance-gate';

function formatEvent(event: typeof servicesRenderedEvents.$inferSelect) {
  return {
    id: event.id,
    client_id: event.clientId,
    service_engagement_id: event.serviceEngagementId,
    event_type: event.eventType,
    source_dispute_id: event.sourceDisputeId,
    occurred_at: event.occurredAt?.toISOString(),
    recorded_by_id: event.recordedById,
    notes: event.notes,
    created_at: event.createdAt?.toISOString(),
  };
}

async function validateAdmin() {
  return getAdminSessionUser('super_admin');
}

export async function POST(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const clientId = body.client_id as string | undefined;
    const serviceEngagementId = body.service_engagement_id as string | undefined;
    const eventType = body.event_type as string | undefined;
    const sourceDisputeId = body.source_dispute_id as string | undefined;
    const notes = (body.notes as string | undefined) || null;

    if (!clientId || !serviceEngagementId || !eventType) {
      return NextResponse.json({ error: 'Client ID, service engagement ID, and event type are required' }, { status: 400 });
    }

    if (eventType !== 'first_dispute_package_submitted') {
      return NextResponse.json({ error: 'Unsupported services rendered event type' }, { status: 400 });
    }

    if (!sourceDisputeId) {
      return NextResponse.json({ error: 'Source dispute ID is required for first dispute package submitted events' }, { status: 400 });
    }

    const [sourceDispute] = await db
      .select({
        id: disputes.id,
        clientId: disputes.clientId,
        serviceEngagementId: disputes.serviceEngagementId,
        status: disputes.status,
        sentAt: disputes.sentAt,
        submissionMethod: disputes.submissionMethod,
      })
      .from(disputes)
      .where(and(eq(disputes.id, sourceDisputeId), eq(disputes.clientId, clientId)))
      .limit(1);

    if (!sourceDispute) {
      return NextResponse.json({ error: 'Source dispute not found for client' }, { status: 404 });
    }

    if (sourceDispute.serviceEngagementId && sourceDispute.serviceEngagementId !== serviceEngagementId) {
      return NextResponse.json({ error: 'Source dispute does not belong to the Service Engagement' }, { status: 400 });
    }

    if (!sourceDispute.sentAt || !sourceDispute.submissionMethod || !['sent', 'in_progress', 'responded', 'resolved'].includes(sourceDispute.status || '')) {
      return NextResponse.json({ error: 'First dispute package submitted requires a submitted dispute package' }, { status: 400 });
    }

    const gateRecords = await db
      .select({
        checkKey: complianceGateChecks.checkKey,
        passed: complianceGateChecks.passed,
        checkedAt: complianceGateChecks.checkedAt,
        notes: complianceGateChecks.notes,
      })
      .from(complianceGateChecks)
      .where(eq(complianceGateChecks.engagementId, serviceEngagementId));

    const complianceDecision = evaluateComplianceGateAction({
      records: gateRecords,
      action: 'mark_services_rendered',
    });

    if (!complianceDecision.allowed) {
      return NextResponse.json({
        error: 'Compliance Gate must pass before recording Services Rendered',
        code: complianceDecision.code,
        blocking_checks: complianceDecision.blockingChecks,
      }, { status: 409 });
    }

    const now = new Date();
    const [created] = await db.insert(servicesRenderedEvents).values({
      id: randomUUID(),
      clientId,
      serviceEngagementId,
      eventType,
      sourceDisputeId,
      occurredAt: sourceDispute.sentAt,
      recordedById: adminUser.id,
      notes,
      createdAt: now,
    }).returning();

    return NextResponse.json(formatEvent(created), { status: 201 });
  } catch (error) {
    console.error('Error recording services rendered event:', error);
    return NextResponse.json({ error: 'Failed to record services rendered event' }, { status: 500 });
  }
}

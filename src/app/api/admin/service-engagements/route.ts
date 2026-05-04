import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { clients, complianceGateChecks, serviceEngagements } from '@/db/schema';
import { getBlockingComplianceGateChecks } from '@/lib/compliance-gate';
import { getAdminSessionUser } from '@/lib/admin-session';

const allowedServiceTypes = new Set(['credit_audit', 'credit_restoration']);

function formatEngagement(engagement: typeof serviceEngagements.$inferSelect) {
  return {
    id: engagement.id,
    client_id: engagement.clientId,
    service_type: engagement.serviceType,
    status: engagement.status,
    lifecycle_stage: engagement.lifecycleStage,
    opened_at: engagement.openedAt?.toISOString(),
    closed_at: engagement.closedAt?.toISOString() || null,
    closure_reason: engagement.closureReason,
    created_at: engagement.createdAt?.toISOString(),
    updated_at: engagement.updatedAt?.toISOString(),
  };
}

async function validateAdmin() {
  return getAdminSessionUser('super_admin');
}

export async function GET(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = request.nextUrl.searchParams.get('client_id');
  if (!clientId) {
    return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
  }

  try {
    const items = await db
      .select()
      .from(serviceEngagements)
      .where(eq(serviceEngagements.clientId, clientId));

    return NextResponse.json({ items: items.map(formatEngagement) });
  } catch (error) {
    console.error('Error fetching service engagements:', error);
    return NextResponse.json({ error: 'Failed to fetch service engagements' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const clientId = body.client_id;
    const serviceType = body.service_type;

    if (!clientId || !serviceType) {
      return NextResponse.json({ error: 'Client ID and service type are required' }, { status: 400 });
    }

    if (!allowedServiceTypes.has(serviceType)) {
      return NextResponse.json({ error: 'Invalid service type' }, { status: 400 });
    }

    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const [activeEngagement] = await db
      .select({ id: serviceEngagements.id })
      .from(serviceEngagements)
      .where(and(
        eq(serviceEngagements.clientId, clientId),
        eq(serviceEngagements.serviceType, serviceType),
        eq(serviceEngagements.status, 'active'),
      ))
      .limit(1);

    if (activeEngagement) {
      return NextResponse.json(
        { error: 'Client already has an active engagement for this service type' },
        { status: 409 },
      );
    }

    const now = new Date();
    const [created] = await db.insert(serviceEngagements).values({
      id: randomUUID(),
      clientId,
      serviceType,
      status: 'active',
      lifecycleStage: body.lifecycle_stage || 'lead',
      openedAt: now,
      createdAt: now,
      updatedAt: now,
    }).returning();

    return NextResponse.json(formatEngagement(created), { status: 201 });
  } catch (error) {
    console.error('Error creating service engagement:', error);
    return NextResponse.json({ error: 'Failed to create service engagement' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = body.id;
    const lifecycleStage = body.lifecycle_stage;

    if (!id || !lifecycleStage) {
      return NextResponse.json({ error: 'Engagement ID and lifecycle stage are required' }, { status: 400 });
    }

    const [engagement] = await db
      .select({ id: serviceEngagements.id })
      .from(serviceEngagements)
      .where(eq(serviceEngagements.id, id))
      .limit(1);

    if (!engagement) {
      return NextResponse.json({ error: 'Service engagement not found' }, { status: 404 });
    }

    if (lifecycleStage === 'ready_for_first_work') {
      const gateRecords = await db
        .select({
          checkKey: complianceGateChecks.checkKey,
          passed: complianceGateChecks.passed,
          checkedAt: complianceGateChecks.checkedAt,
          notes: complianceGateChecks.notes,
        })
        .from(complianceGateChecks)
        .where(eq(complianceGateChecks.engagementId, id));

      const blockingChecks = getBlockingComplianceGateChecks(gateRecords);
      if (blockingChecks.length > 0) {
        return NextResponse.json({
          error: 'Compliance Gate must pass before Ready for First Work',
          blocking_checks: blockingChecks,
        }, { status: 409 });
      }
    }

    const [updated] = await db
      .update(serviceEngagements)
      .set({ lifecycleStage, updatedAt: new Date() })
      .where(eq(serviceEngagements.id, id))
      .returning();

    return NextResponse.json(formatEngagement(updated));
  } catch (error) {
    console.error('Error updating service engagement:', error);
    return NextResponse.json({ error: 'Failed to update service engagement' }, { status: 500 });
  }
}

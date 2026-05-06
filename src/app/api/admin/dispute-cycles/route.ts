import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { disputeCycles, serviceEngagements } from '@/db/schema';
import { getAdminSessionUser } from '@/lib/admin-session';
import { evaluateDisputeCycleDraft } from '@/lib/dispute-cycle-workflow';

function parseJsonArray(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatCycle(cycle: typeof disputeCycles.$inferSelect) {
  return {
    id: cycle.id,
    client_id: cycle.clientId,
    service_engagement_id: cycle.serviceEngagementId,
    cycle_number: cycle.cycleNumber,
    status: cycle.status,
    item_selection: parseJsonArray(cycle.itemSelection),
    created_at: cycle.createdAt?.toISOString(),
    updated_at: cycle.updatedAt?.toISOString(),
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
    const clientId = body.client_id;
    const serviceEngagementId = body.service_engagement_id;
    const cycleNumber = body.cycle_number;
    const itemSelection = Array.isArray(body.item_selection) ? body.item_selection : [];

    if (!clientId || !serviceEngagementId || !cycleNumber) {
      return NextResponse.json({ error: 'Client ID, service engagement ID, and cycle number are required' }, { status: 400 });
    }

    const cycleDecision = evaluateDisputeCycleDraft({ itemSelection });
    if (!cycleDecision.allowed) {
      return NextResponse.json({
        error: cycleDecision.reason,
        code: cycleDecision.code,
      }, { status: 400 });
    }

    const [engagement] = await db
      .select({ id: serviceEngagements.id, clientId: serviceEngagements.clientId })
      .from(serviceEngagements)
      .where(and(eq(serviceEngagements.id, serviceEngagementId), eq(serviceEngagements.clientId, clientId)))
      .limit(1);

    if (!engagement) {
      return NextResponse.json({ error: 'Service engagement not found for client' }, { status: 404 });
    }

    const now = new Date();
    const [created] = await db.insert(disputeCycles).values({
      id: randomUUID(),
      clientId,
      serviceEngagementId,
      cycleNumber,
      status: 'draft',
      itemSelection: JSON.stringify(itemSelection),
      createdAt: now,
      updatedAt: now,
    }).returning();

    return NextResponse.json(formatCycle(created), { status: 201 });
  } catch (error) {
    console.error('Error creating dispute cycle:', error);
    return NextResponse.json({ error: 'Failed to create dispute cycle' }, { status: 500 });
  }
}

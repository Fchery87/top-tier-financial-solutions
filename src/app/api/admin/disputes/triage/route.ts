import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { negativeItems } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { triageItems } from '@/lib/dispute-triage';

async function validateAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.email) return null;
  const ok = await isSuperAdmin(session.user.email);
  return ok ? session.user : null;
}

export async function POST(request: NextRequest) {
  const admin = await validateAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientId, round = 1, itemIds }: { clientId?: string; round?: number; itemIds?: string[] } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const where = itemIds && itemIds.length > 0
      ? and(eq(negativeItems.clientId, clientId), inArray(negativeItems.id, itemIds))
      : eq(negativeItems.clientId, clientId);

    const items = await db.select().from(negativeItems).where(where);

    const triageReady = items.map((item) => ({
      id: item.id,
      creditorName: item.creditorName,
      itemType: item.itemType,
      amount: item.amount,
      dateReported: item.dateReported?.toISOString() ?? null,
      riskSeverity: item.riskSeverity ?? 'medium',
      recommendedAction: item.recommendedAction,
      onTransunion: item.onTransunion ?? undefined,
      onExperian: item.onExperian ?? undefined,
      onEquifax: item.onEquifax ?? undefined,
      bureau: item.bureau ?? null,
      transunionStatus: item.transunionStatus,
      experianStatus: item.experianStatus,
      equifaxStatus: item.equifaxStatus,
    }));

    const summary = triageItems(triageReady, round);

    return NextResponse.json({
      success: true,
      round,
      items: triageReady.length,
      ...summary,
    });
  } catch (error) {
    console.error('Error triaging disputes:', error);
    return NextResponse.json({ error: 'Failed to triage items' }, { status: 500 });
  }
}

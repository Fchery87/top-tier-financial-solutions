import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { clients, disputes, letterApprovals } from '@/db/schema';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { eq, and, inArray, desc, isNotNull } from 'drizzle-orm';
import { randomUUID } from 'crypto';

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user?.id) {
    return null;
  }

  return session.user;
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.userId, user.id))
      .limit(1);

    if (!client) {
      return NextResponse.json({ letters: [] });
    }

    const clientDisputes = await db
      .select()
      .from(disputes)
      .where(and(eq(disputes.clientId, client.id), isNotNull(disputes.letterContent)))
      .orderBy(desc(disputes.createdAt));

    if (clientDisputes.length === 0) {
      return NextResponse.json({ letters: [] });
    }

    const currentRound = clientDisputes.reduce((max, d) => {
      const r = d.round || 1;
      return r > max ? r : max;
    }, 1);

    const relevantDisputes = clientDisputes.filter((d) => {
      const round = d.round || 1;
      if (round !== currentRound) return false;
      const status = d.status || 'draft';
      return ['draft', 'ready', 'sent', 'in_progress'].includes(status);
    });

    if (relevantDisputes.length === 0) {
      return NextResponse.json({ letters: [] });
    }

    const disputeIds = relevantDisputes.map((d) => d.id);

    const existingApprovals = await db
      .select()
      .from(letterApprovals)
      .where(inArray(letterApprovals.disputeId, disputeIds));

    const approvalsByDisputeId = new Map<string, (typeof existingApprovals)[number]>();
    for (const approval of existingApprovals) {
      if (approval.disputeId) {
        approvalsByDisputeId.set(approval.disputeId, approval);
      }
    }

    const approvalsToCreate = relevantDisputes
      .filter((d) => !approvalsByDisputeId.has(d.id))
      .map((d) => ({
        id: randomUUID(),
        clientId: client.id,
        disputeId: d.id,
        batchId: d.batchId,
        round: d.round,
      }));

    if (approvalsToCreate.length > 0) {
      await db.insert(letterApprovals).values(approvalsToCreate);

      const newApprovals = await db
        .select()
        .from(letterApprovals)
        .where(inArray(letterApprovals.disputeId, disputeIds));

      approvalsByDisputeId.clear();
      for (const approval of newApprovals) {
        if (approval.disputeId) {
          approvalsByDisputeId.set(approval.disputeId, approval);
        }
      }
    }

    const letters = relevantDisputes.map((d) => {
      const approval = approvalsByDisputeId.get(d.id);

      return {
        approval_id: approval?.id || null,
        dispute_id: d.id,
        bureau: d.bureau,
        round: d.round,
        status: approval?.status || 'pending',
        creditor_name: d.creditorName || 'Item under dispute',
        letter_content: d.letterContent,
        created_at: d.createdAt?.toISOString() || null,
        approved_at: approval?.approvedAt?.toISOString() || null,
        rejected_at: approval?.rejectedAt?.toISOString() || null,
      };
    });

    return NextResponse.json({ letters });
  } catch (error) {
    console.error('Error fetching portal letters:', error);
    return NextResponse.json({ error: 'Failed to fetch letters for approval' }, { status: 500 });
  }
}

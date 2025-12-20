import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { disputes, negativeItems, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { generateUniqueDisputeLetter } from '@/lib/ai-letter-generator';

async function validateAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) return null;
  const ok = await isSuperAdmin(session.user.email);
  return ok ? session.user : null;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [currentDispute] = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
    if (!currentDispute) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    if (currentDispute.outcome !== 'verified') {
      return NextResponse.json({ error: 'Quick re-dispute is only available for verified items' }, { status: 400 });
    }

    const [client] = await db.select().from(clients).where(eq(clients.id, currentDispute.clientId)).limit(1);
    const [negativeItem] = currentDispute.negativeItemId
      ? await db.select().from(negativeItems).where(eq(negativeItems.id, currentDispute.negativeItemId)).limit(1)
      : [];

    if (!client || !negativeItem) {
      return NextResponse.json({ error: 'Client or negative item missing for escalation' }, { status: 400 });
    }

    const nextRound = (currentDispute.round || 1) + 1;
    const targetRecipient = nextRound === 2 ? 'bureau' : 'creditor';
    const nextDisputeType = nextRound === 2 ? 'method_of_verification' : 'direct_creditor';
    const methodology = nextRound === 2 ? 'method_of_verification' : 'consumer_law';
    const reasonCodes = nextRound === 2
      ? ['previously_disputed', 'request_verification_method']
      : ['verification_required', 'metro2_violation'];

    const letterContent = await generateUniqueDisputeLetter({
      disputeType: nextDisputeType,
      round: nextRound,
      targetRecipient,
      methodology,
      clientData: { name: `${client.firstName} ${client.lastName}` },
      itemData: {
        creditorName: negativeItem.creditorName,
        originalCreditor: negativeItem.originalCreditor || undefined,
        accountNumber: negativeItem.id.slice(-8),
        itemType: negativeItem.itemType,
        amount: negativeItem.amount || undefined,
        dateReported: negativeItem.dateReported?.toISOString(),
        bureau: currentDispute.bureau,
      },
      reasonCodes,
      customReason: `Escalation after verification in Round ${currentDispute.round || 1}`,
    });

    const now = new Date();
    const nextDisputeId = randomUUID();

    await db.insert(disputes).values({
      id: nextDisputeId,
      clientId: currentDispute.clientId,
      negativeItemId: currentDispute.negativeItemId,
      bureau: currentDispute.bureau,
      disputeReason: `Escalation after verification in Round ${currentDispute.round || 1}`,
      disputeType: nextDisputeType,
      status: 'draft',
      round: nextRound,
      escalationPath: targetRecipient,
      letterContent,
      creditorName: negativeItem.creditorName,
      accountNumber: negativeItem.id.slice(-8),
      generatedByAi: true,
      methodology,
      priorDisputeId: currentDispute.id,
      reasonCodes: JSON.stringify(reasonCodes),
      analysisConfidence: currentDispute.analysisConfidence,
      autoSelected: currentDispute.autoSelected,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db.select().from(disputes).where(eq(disputes.id, nextDisputeId)).limit(1);

    return NextResponse.json({
      message: 'Escalation dispute created',
      dispute: {
        id: created.id,
        round: created.round,
        dispute_type: created.disputeType,
        status: created.status,
      },
    });
  } catch (error) {
    console.error('Error creating quick re-dispute:', error);
    return NextResponse.json({ error: 'Failed to create quick re-dispute' }, { status: 500 });
  }
}

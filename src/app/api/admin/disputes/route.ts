import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { disputes, clients, negativeItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { generateUniqueDisputeLetter } from '@/lib/ai-letter-generator';

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

export async function POST(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { clientId, negativeItemId, bureau, disputeReason, disputeType } = body;

    if (!clientId || !bureau || !disputeReason) {
      return NextResponse.json(
        { error: 'Client ID, bureau, and dispute reason are required' },
        { status: 400 }
      );
    }

    // Get client info
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get negative item info if provided
    let negativeItem = null;
    if (negativeItemId) {
      const [item] = await db
        .select()
        .from(negativeItems)
        .where(eq(negativeItems.id, negativeItemId))
        .limit(1);
      negativeItem = item;
    }

    // Generate dispute letter using AI generator with FCRA/CRSA/Metro2 compliance
    const letterContent = await generateUniqueDisputeLetter({
      disputeType: disputeType || 'standard',
      round: 1,
      targetRecipient: 'bureau',
      clientData: {
        name: `${client.firstName} ${client.lastName}`,
      },
      itemData: {
        creditorName: negativeItem?.creditorName || 'Unknown Creditor',
        originalCreditor: negativeItem?.originalCreditor || undefined,
        accountNumber: negativeItem?.id?.slice(-8) || undefined,
        itemType: negativeItem?.itemType || 'unknown',
        amount: negativeItem?.amount || undefined,
        dateReported: negativeItem?.dateReported?.toISOString() || undefined,
        bureau,
      },
      reasonCodes: [disputeReason.includes('not mine') ? 'not_mine' : 
                    disputeReason.includes('never late') ? 'never_late' : 
                    disputeReason.includes('wrong') ? 'wrong_balance' : 'not_mine'],
      customReason: disputeReason,
    });

    // Create dispute record
    const id = randomUUID();
    const now = new Date();

    await db.insert(disputes).values({
      id,
      clientId,
      negativeItemId: negativeItemId || null,
      bureau,
      disputeReason,
      disputeType: disputeType || 'standard',
      status: 'draft',
      round: 1,
      letterContent,
      createdAt: now,
      updatedAt: now,
    });

    // Fetch the created dispute
    const [createdDispute] = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, id))
      .limit(1);

    return NextResponse.json({
      id: createdDispute.id,
      client_id: createdDispute.clientId,
      negative_item_id: createdDispute.negativeItemId,
      bureau: createdDispute.bureau,
      dispute_reason: createdDispute.disputeReason,
      dispute_type: createdDispute.disputeType,
      status: createdDispute.status,
      round: createdDispute.round,
      letter_content: createdDispute.letterContent,
      created_at: createdDispute.createdAt?.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating dispute:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create dispute' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('client_id');

  // SECURITY: client_id is required to prevent cross-client data exposure
  if (!clientId) {
    return NextResponse.json(
      { error: 'client_id is required' },
      { status: 400 }
    );
  }

  try {
    const allDisputes = await db
      .select()
      .from(disputes)
      .where(eq(disputes.clientId, clientId));

    return NextResponse.json({
      disputes: allDisputes.map(d => ({
        id: d.id,
        client_id: d.clientId,
        negative_item_id: d.negativeItemId,
        bureau: d.bureau,
        dispute_reason: d.disputeReason,
        dispute_type: d.disputeType,
        status: d.status,
        round: d.round,
        letter_content: d.letterContent,
        tracking_number: d.trackingNumber,
        sent_at: d.sentAt?.toISOString(),
        outcome: d.outcome,
        created_at: d.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching disputes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch disputes' },
      { status: 500 }
    );
  }
}

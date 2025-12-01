import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { clients, negativeItems } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateUniqueDisputeLetter, DISPUTE_REASON_CODES } from '@/lib/ai-letter-generator';

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
    const {
      clientId,
      negativeItemId,
      bureau,
      disputeType,
      round,
      targetRecipient,
      reasonCodes,
      customReason,
    } = body;

    if (!clientId || !bureau) {
      return NextResponse.json(
        { error: 'Client ID and bureau are required' },
        { status: 400 }
      );
    }

    if (!reasonCodes || reasonCodes.length === 0) {
      return NextResponse.json(
        { error: 'At least one reason code is required' },
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

    // Generate the letter using AI
    const letterContent = await generateUniqueDisputeLetter({
      disputeType: disputeType || 'standard',
      round: round || 1,
      targetRecipient: targetRecipient || 'bureau',
      clientData: {
        name: `${client.firstName} ${client.lastName}`,
        address: undefined,
        city: undefined,
        state: undefined,
        zip: undefined,
      },
      itemData: {
        creditorName: negativeItem?.creditorName || body.creditorName || 'Unknown Creditor',
        originalCreditor: negativeItem?.originalCreditor || undefined,
        accountNumber: negativeItem?.id?.slice(-8) || body.accountNumber || undefined,
        itemType: negativeItem?.itemType || body.itemType || 'unknown',
        amount: negativeItem?.amount || body.amount || undefined,
        dateReported: negativeItem?.dateReported?.toISOString() || undefined,
        bureau: bureau,
      },
      reasonCodes: reasonCodes,
      customReason: customReason,
    });

    return NextResponse.json({
      letter_content: letterContent,
      client_name: `${client.firstName} ${client.lastName}`,
      bureau: bureau,
      round: round || 1,
      dispute_type: disputeType || 'standard',
      reason_codes: reasonCodes,
    });
  } catch (error) {
    console.error('Error generating dispute letter:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate letter' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const adminUser = await validateAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Return available reason codes
  return NextResponse.json({
    reason_codes: DISPUTE_REASON_CODES,
    dispute_types: [
      { code: 'standard', label: 'Standard Bureau Dispute' },
      { code: 'method_of_verification', label: 'Method of Verification' },
      { code: 'direct_creditor', label: 'Direct to Creditor' },
      { code: 'debt_validation', label: 'Debt Validation' },
      { code: 'goodwill', label: 'Goodwill Request' },
      { code: 'cease_desist', label: 'Cease and Desist' },
    ],
    target_recipients: [
      { code: 'bureau', label: 'Credit Bureau' },
      { code: 'creditor', label: 'Creditor/Furnisher' },
      { code: 'collector', label: 'Collection Agency' },
    ],
  });
}

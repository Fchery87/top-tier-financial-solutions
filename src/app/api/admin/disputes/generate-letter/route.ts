import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { isSuperAdmin } from '@/lib/admin-auth';
import { db } from '@/db/client';
import { clients, negativeItems, clientDocuments } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { generateUniqueDisputeLetter, generateMultiItemDisputeLetter, DISPUTE_REASON_CODES } from '@/lib/ai-letter-generator';
import { DOCUMENT_TYPE_LABELS } from '@/lib/dispute-evidence';

const HIGH_RISK_CODES = new Set([
  'identity_theft',
  'not_mine',
  'never_late',
  'mixed_file',
]);

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
      negativeItemIds, // Support for multiple items
      bureau,
      disputeType,
      round,
      targetRecipient,
      reasonCodes,
      customReason,
      combineItems, // Flag to indicate combined letter mode
      methodology, // NEW: Dispute methodology (factual, metro2_compliance, etc.)
      metro2Violations, // NEW: Specific Metro 2 field violations
      priorDisputeDate, // NEW: For method of verification letters
      priorDisputeResult, // NEW: Result of prior dispute
      evidenceDocumentIds, // Optional: evidence attachments (clientDocuments IDs)
    } = body;

    if (!clientId || !bureau) {
      return NextResponse.json(
        { error: 'Client ID and bureau are required' },
        { status: 400 }
      );
    }

    if (
      reasonCodes.some((code: string) => HIGH_RISK_CODES.has(code)) &&
      (!evidenceDocumentIds || evidenceDocumentIds.length === 0)
    ) {
      return NextResponse.json(
        { error: 'High-risk reason codes require evidenceDocumentIds.' },
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

    // Fetch evidence documents if provided to build enclosures list
    let enclosures: { documentType: string; documentName: string }[] = [];
    if (evidenceDocumentIds && evidenceDocumentIds.length > 0) {
      const evidenceDocs = await db
        .select()
        .from(clientDocuments)
        .where(inArray(clientDocuments.id, evidenceDocumentIds));
      
      enclosures = evidenceDocs.map(doc => ({
        documentType: doc.fileType || 'other',
        documentName: DOCUMENT_TYPE_LABELS[doc.fileType as keyof typeof DOCUMENT_TYPE_LABELS] || doc.fileName,
      }));
    }

    // Handle multi-item combined letter
    if (combineItems && negativeItemIds && negativeItemIds.length > 0) {
      // Fetch all negative items
      const items = await Promise.all(
        negativeItemIds.map(async (itemId: string) => {
          const [item] = await db
            .select()
            .from(negativeItems)
            .where(eq(negativeItems.id, itemId))
            .limit(1);
          return item;
        })
      );

      const validItems = items.filter(Boolean);

      if (validItems.length === 0) {
        return NextResponse.json({ error: 'No valid items found' }, { status: 400 });
      }

      // Generate combined letter
      const letterContent = await generateMultiItemDisputeLetter({
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
        items: validItems.map(item => ({
          creditorName: item.creditorName,
          originalCreditor: item.originalCreditor || undefined,
          accountNumber: item.id.slice(-8),
          itemType: item.itemType,
          amount: item.amount || undefined,
          dateReported: item.dateReported?.toISOString(),
          bureau: bureau,
        })),
        bureau: bureau,
        reasonCodes: reasonCodes,
        customReason: customReason,
        methodology: methodology,
        metro2Violations: metro2Violations,
        enclosures: enclosures,
      });

      return NextResponse.json({
        letter_content: letterContent,
        client_name: `${client.firstName} ${client.lastName}`,
        bureau: bureau,
        round: round || 1,
        dispute_type: disputeType || 'standard',
        reason_codes: reasonCodes,
        item_count: validItems.length,
        item_ids: negativeItemIds,
        combined: true,
      });
    }

    // Single item letter (original behavior)
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
      methodology: methodology,
      metro2Violations: metro2Violations,
      priorDisputeDate: priorDisputeDate,
      priorDisputeResult: priorDisputeResult,
      enclosures: enclosures,
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
      combined: false,
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
